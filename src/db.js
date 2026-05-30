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

export async function addEvent(rawText) {
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

export async function getAllEvents() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  // reverse-chronological
  return all.sort((a, b) => (a.timestamp_start < b.timestamp_start ? 1 : -1))
}

export async function clearAllEvents() {
  const db = await getDB()
  return db.clear(STORE)
}
