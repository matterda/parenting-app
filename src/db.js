import { openDB } from 'idb'

const DB_NAME = 'baby-log'
const DB_VERSION = 1
const STORE = 'events'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      store.createIndex('timestamp_start', 'timestamp_start')
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
    updated_at: new Date().toISOString(),
  }
  await db.put(STORE, record)
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
  const tx = db.transaction(STORE, 'readwrite')
  await tx.store.delete(placeholderId)
  const saved = []
  for (const ev of confirmedEvents) {
    const record = { ...ev, id: newId(), extracted: true, updated_at: new Date().toISOString() }
    await tx.store.put(record)
    saved.push(record)
  }
  await tx.done
  return saved
}

export async function updateEvent(id, patch) {
  const db = await getDB()
  const existing = await db.get(STORE, id)
  if (!existing) throw new Error(`Event ${id} not found`)
  return db.put(STORE, { ...existing, ...patch, updated_at: new Date().toISOString() })
}

// Upsert: create if not present, keep the more-recently-updated copy on conflict.
// Falls back to keeping existing when neither has updated_at (legacy records).
export async function upsertEvent(ev) {
  const db = await getDB()
  // Legacy events have numeric IDs; new ones are UUID strings. Only coerce
  // purely-numeric strings back to numbers — never mangle a UUID into NaN.
  const normId = typeof ev.id === 'string' && /^\d+$/.test(ev.id) ? Number(ev.id) : ev.id
  const normEv = normId !== ev.id ? { ...ev, id: normId } : ev
  const existing = await db.get(STORE, normId)
  if (!existing) {
    return db.put(STORE, normEv)
  }
  // Prefer whichever copy was updated more recently
  const remoteTs = normEv.updated_at ?? ''
  const localTs  = existing.updated_at ?? ''
  return db.put(STORE, remoteTs > localTs ? normEv : existing)
}

export async function deleteEvent(id) {
  const db = await getDB()
  return db.delete(STORE, id)
}

export async function getAllEvents() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime())
}

export async function clearAllEvents() {
  const db = await getDB()
  return db.clear(STORE)
}
