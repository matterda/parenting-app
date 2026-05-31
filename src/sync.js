// Firebase Realtime Database sync.
// Events are stored as an object keyed by event ID: { [id]: event }
// Both devices push on every write and pull on open / visibilitychange.

export function getSyncUrl() {
  return (localStorage.getItem('firebase_sync_url') ?? '').replace(/\/$/, '')
}

function eventsEndpoint(base) {
  return `${base}/events.json`
}

// Push all local events to Firebase (full overwrite of /events)
export async function syncPush(events) {
  const base = getSyncUrl()
  if (!base) return
  const obj = {}
  for (const ev of events) obj[ev.id] = ev
  await fetch(eventsEndpoint(base), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
}

// Delete a single event from Firebase
export async function syncDelete(id) {
  const base = getSyncUrl()
  if (!base) return
  await fetch(`${base}/events/${id}.json`, { method: 'DELETE' })
}

// Pull all remote events; returns array (empty if no URL or error)
export async function syncPull() {
  const base = getSyncUrl()
  if (!base) return []
  try {
    const res = await fetch(eventsEndpoint(base))
    if (!res.ok) return []
    const data = await res.json()
    if (!data) return []
    return Object.values(data)
  } catch {
    return []
  }
}
