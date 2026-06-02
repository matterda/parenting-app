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
    raw_text: rawText,
    timestamp_start: new Date().toISOString(),
    timestamp_end: null,
    type: null,
    data: null,
    context_note: null,
    confidence: null,
    needs_confirmation: [],
    extracted: false
  }
  const id = await db.add(STORE, record)
  return { ...record, id }
}

// Replace the raw placeholder with the confirmed extracted events.
// Deletes the placeholder record and writes one record per extracted event.
export async function replaceWithExtracted(placeholderId, confirmedEvents) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  await tx.store.delete(placeholderId)
  const saved = []
  for (const ev of confirmedEvents) {
    const record = { ...ev, extracted: true, updated_at: new Date().toISOString() }
    delete record.id // let IDB assign a new auto-increment id
    const id = await tx.store.add(record)
    saved.push({ ...record, id })
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
  // Normalise ID: Firebase JSON keys round-trip as numbers, but be safe.
  const normId = typeof ev.id === 'string' ? Number(ev.id) : ev.id
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
