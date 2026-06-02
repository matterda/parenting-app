// Firebase Realtime Database sync.
// Events stored as object keyed by event ID: { [id]: event }
// Tombstones stored at /tombstones/{id} = deletedAt ISO string
// Both devices push on every write and pull on open / visibilitychange.

export function getSyncUrl() {
  return (localStorage.getItem('firebase_sync_url') ?? '').replace(/\/$/, '')
}

// Push all local events to Firebase (full overwrite of /events)
export async function syncPush(events) {
  const base = getSyncUrl()
  if (!base) return
  const obj = {}
  for (const ev of events) obj[ev.id] = ev
  await fetch(`${base}/events.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
}

// Delete a single event from Firebase and record a tombstone
export async function syncDelete(id) {
  const base = getSyncUrl()
  if (!base) return
  await Promise.all([
    fetch(`${base}/events/${id}.json`, { method: 'DELETE' }),
    fetch(`${base}/tombstones/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(new Date().toISOString()),
    }),
  ])
}

// Pull all remote events + tombstones.
// Returns { events: Event[], tombstoneIds: string[] }
export async function syncPull() {
  const base = getSyncUrl()
  if (!base) return { events: [], tombstoneIds: [] }
  try {
    const [evRes, tbRes] = await Promise.all([
      fetch(`${base}/events.json`),
      fetch(`${base}/tombstones.json`),
    ])
    const evData = evRes.ok ? await evRes.json() : null
    const tbData = tbRes.ok ? await tbRes.json() : null
    // IDB auto-increment keys are numbers; Firebase JSON keys are strings — coerce back.
    const coerceId = id => (isNaN(Number(id)) ? id : Number(id))
    return {
      events: evData ? Object.values(evData) : [],
      tombstoneIds: tbData ? Object.keys(tbData).map(coerceId) : [],
    }
  } catch {
    return { events: [], tombstoneIds: [] }
  }
}
