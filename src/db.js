import { openDB } from 'idb'
import { mergeEvent } from './utils/mergeEvent'
import { serverNow } from './utils/serverTime'
import { appendLog } from './utils/eventLog'

const DB_NAME = 'baby-log'
const DB_VERSION = 2
const STORE = 'events'
export const LOG_STORE = 'event_log'

export function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp_start', 'timestamp_start')
      }
      if (oldVersion < 2) {
        // Append-only operation log — every create/update/delete is recorded
        // here so the full history can be reconstructed even if the events
        // store (or the remote DB) is wiped. seq is a monotonic local key.
        db.createObjectStore(LOG_STORE, { keyPath: 'seq', autoIncrement: true })
      }
    }
  })
}

// Save a single raw entry before extraction (so nothing is lost if API fails)
export async function addRawEvent(rawText) {
  const db = await getDB()
  const record = {
    id: newId(),
    raw_text: rawText,
    timestamp_start: new Date().toISOString(),
    timestamp_end: null,
    type: null,
    data: null,
    context_note: null,
    confidence: null,
    needs_confirmation: [],
    extracted: false,
    updated_at: serverNow(),
  }
  await db.put(STORE, record)
  await appendLog({ op: 'create', id: record.id, before: null, after: record, source: 'user' })
  return record
}

// Globally-unique ID. Auto-increment integers collide across devices (both
// phones independently mint id 1, 2, 3…), which corrupts Firebase sync, so
// every new record gets a UUID instead.
function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for very old browsers
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

// Replace the raw placeholder with the confirmed extracted events.
// Deletes the placeholder record and writes one record per extracted event.
export async function replaceWithExtracted(placeholderId, confirmedEvents) {
  const db = await getDB()
  const before = await db.get(STORE, placeholderId)
  const tx = db.transaction(STORE, 'readwrite')
  await tx.store.delete(placeholderId)
  const saved = []
  for (const ev of confirmedEvents) {
    const record = { ...ev, id: newId(), extracted: true, updated_at: serverNow() }
    await tx.store.put(record)
    saved.push(record)
  }
  await tx.done
  // Log the placeholder removal then each extracted insert.
  await appendLog({ op: 'delete', id: placeholderId, before: before ?? null, after: null, source: 'user' })
  for (const record of saved) {
    await appendLog({ op: 'create', id: record.id, before: null, after: record, source: 'user' })
  }
  return saved
}

export async function updateEvent(id, patch) {
  const db = await getDB()
  const existing = await db.get(STORE, id)
  if (!existing) throw new Error(`Event ${id} not found`)
  const updated = { ...existing, ...patch, updated_at: serverNow() }
  await db.put(STORE, updated)
  await appendLog({ op: 'update', id, before: existing, after: updated, source: 'user' })
  return updated
}

// Upsert: create if not present, otherwise field-level merge with the existing
// copy (see mergeEvent) so concurrent edits from different devices combine
// instead of clobbering each other.
export async function upsertEvent(ev) {
  const db = await getDB()
  // Legacy events have numeric IDs; new ones are UUID strings. Only coerce
  // purely-numeric strings back to numbers — never mangle a UUID into NaN.
  const normId = typeof ev.id === 'string' && /^\d+$/.test(ev.id) ? Number(ev.id) : ev.id
  const normEv = normId !== ev.id ? { ...ev, id: normId } : ev
  const existing = await db.get(STORE, normId)
  if (!existing) {
    await db.put(STORE, normEv)
    await appendLog({ op: 'create', id: normId, before: null, after: normEv, source: 'sync' })
    return normEv
  }
  const merged = mergeEvent(existing, normEv)
  merged.id = normId
  await db.put(STORE, merged)
  // Only log when the merge actually changed something, to avoid flooding the
  // log with no-op sync writes.
  if (JSON.stringify(merged) !== JSON.stringify(existing)) {
    await appendLog({ op: 'update', id: normId, before: existing, after: merged, source: 'sync' })
  }
  return merged
}

export async function deleteEvent(id) {
  const db = await getDB()
  const before = await db.get(STORE, id)
  await db.delete(STORE, id)
  if (before) await appendLog({ op: 'delete', id, before, after: null, source: 'user' })
}

export async function getAllEvents() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime())
}

export async function clearAllEvents() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  await db.clear(STORE)
  for (const ev of all) {
    await appendLog({ op: 'delete', id: ev.id, before: ev, after: null, source: 'user' })
  }
}
