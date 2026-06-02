// Firebase Realtime Database sync.
// Events stored as object keyed by event ID: { [id]: event }
// Tombstones stored at /tombstones/{id} = deletedAt ISO string
// Both devices push on every write and pull on open / visibilitychange.

export function getSyncUrl() {
  return (localStorage.getItem('firebase_sync_url') ?? '').replace(/\/$/, '')
}

// Push local events to Firebase by MERGING (PATCH), not overwriting.
// A full PUT of /events is last-writer-wins over the entire collection: a
// device that pushes a moment after another erases events it never saw. PATCH
// only writes the keys we send, leaving the other device's events intact.
// We also fetch tombstones first and skip any deleted event, so a stale local
// copy can't resurrect something another device already deleted.
export async function syncPush(events) {
  const base = getSyncUrl()
  if (!base) return

  let tombstoned = new Set()
  try {
    const res = await fetch(`${base}/tombstones.json`)
    if (res.ok) {
      const data = await res.json()
      if (data) tombstoned = new Set(Object.keys(data))
    }
  } catch { /* offline — proceed best-effort without tombstone filtering */ }

  const updates = {}
  for (const ev of events) {
    if (tombstoned.has(String(ev.id))) continue
    updates[ev.id] = ev
  }
  if (Object.keys(updates).length === 0) return

  await fetch(`${base}/events.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
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
