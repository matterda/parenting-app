// Firebase Realtime Database sync.
// Events stored as object keyed by event ID: { [id]: event }
// Tombstones stored at /tombstones/{id} = deletedAt ISO string
// Both devices push on every write and pull on open / visibilitychange.

import { mergeEvent } from './utils/mergeEvent'
import { setServerOffset, serverNow } from './utils/serverTime'

export function getSyncUrl() {
  return (localStorage.getItem('firebase_sync_url') ?? '').replace(/\/$/, '')
}

const LAST_PULL_KEY = 'last_pull_at'

// A write can take a little while to land in Firebase after being timestamped
// (slow network, brief offline queueing), so a device pulling right at that
// moment could otherwise move its cursor past a write that hasn't arrived yet.
// Re-requesting a trailing window on every pull means that write just gets
// picked up (harmlessly, as a no-op re-merge) on the next pull instead of
// being missed forever.
const SYNC_SAFETY_MARGIN_MS = 5 * 60 * 1000

// Forget the incremental-pull cursor, forcing the next syncPull to fetch full
// history. Call this whenever the sync URL changes — a cursor from a
// different Firebase project means nothing here.
export function resetSyncCursor() {
  localStorage.removeItem(LAST_PULL_KEY)
}

// Learn the offset between this device's clock and the Firebase server, so
// updated_at ordering is reliable even if a phone's clock is off. We write the
// server-timestamp sentinel to a scratch path; RTDB resolves it and returns the
// server epoch ms in the response body. Roundtrip is corrected with rtt/2.
export async function syncServerTime() {
  const base = getSyncUrl()
  if (!base) return
  try {
    const t0 = Date.now()
    const res = await fetch(`${base}/_serverTime.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ '.sv': 'timestamp' }),
    })
    if (!res.ok) return
    const serverMs = await res.json()
    const localMid = t0 + (Date.now() - t0) / 2
    if (typeof serverMs === 'number') setServerOffset(Math.round(serverMs - localMid))
  } catch { /* offline — keep last known offset */ }
}

// Push local events to Firebase by MERGING (PATCH), not overwriting.
// A full PUT of /events is last-writer-wins over the entire collection: a
// device that pushes a moment after another erases events it never saw. PATCH
// only writes the keys we send, leaving the other device's events intact.
//
// Crucially, PATCH itself is still last-writer-wins *per key* with no timestamp
// check — so before pushing we fetch the current remote state and, per event:
//   - skip any event that's been tombstoned (don't resurrect a delete), and
//   - field-level merge with the remote copy (see mergeEvent), so we neither
//     clobber a newer remote edit nor drop fields the remote hasn't seen yet.
export async function syncPush(events) {
  const base = getSyncUrl()
  if (!base) return

  let remote = {}
  let tombstoned = new Set()
  try {
    const [evRes, tbRes] = await Promise.all([
      fetch(`${base}/events.json`),
      fetch(`${base}/tombstones.json`),
    ])
    if (evRes.ok) remote = (await evRes.json()) || {}
    if (tbRes.ok) {
      const tb = await tbRes.json()
      if (tb) tombstoned = new Set(Object.keys(tb))
    }
  } catch { /* offline — proceed best-effort */ }

  const updates = {}
  for (const ev of events) {
    const key = String(ev.id)
    if (tombstoned.has(key)) continue          // delete wins — never resurrect
    const remoteEv = remote[key]
    if (!remoteEv) {
      updates[key] = ev
      continue
    }
    // Field-level merge with the remote copy so we neither clobber a newer
    // remote edit nor drop fields the remote doesn't have yet. Only write if
    // the merge actually changes the remote value.
    const merged = mergeEvent(ev, remoteEv)
    merged.id = ev.id
    if (JSON.stringify(merged) !== JSON.stringify(remoteEv)) updates[key] = merged
  }
  if (Object.keys(updates).length === 0) return

  await fetch(`${base}/events.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

// Delete a single event from Firebase and record a tombstone.
// Stamped with serverNow(), not the device's raw clock — incremental pulls
// filter tombstones by this value, so it has to share a clock basis with
// updated_at and the pull cursor, or a skewed device's deletes could fall
// outside another device's "since" window and never sync.
export async function syncDelete(id) {
  const base = getSyncUrl()
  if (!base) return
  await Promise.all([
    fetch(`${base}/events/${id}.json`, { method: 'DELETE' }),
    fetch(`${base}/tombstones/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverNow()),
    }),
  ])
}

// Pull remote events + tombstones changed since the last successful pull
// (falling back to full history the first time, or after resetSyncCursor).
// Ordering/filtering by `updated_at` — not `timestamp_start` — is what makes
// an edit to an old entry (e.g. yesterday's feed corrected today) show up:
// editing always bumps updated_at, regardless of how old the entry itself is.
// Returns { events: Event[], tombstoneIds: string[] }
export async function syncPull() {
  const base = getSyncUrl()
  if (!base) return { events: [], tombstoneIds: [] }
  const since = localStorage.getItem(LAST_PULL_KEY)
  const pullStartedAt = serverNow()
  try {
    const range = since
      ? `?${new URLSearchParams({ orderBy: '"updated_at"', startAt: JSON.stringify(since) })}`
      : ''
    // Tombstones are plain ISO-string values (not objects), so order by the
    // value itself rather than a field.
    const tombstoneRange = since
      ? `?${new URLSearchParams({ orderBy: '"$value"', startAt: JSON.stringify(since) })}`
      : ''
    const [evRes, tbRes] = await Promise.all([
      fetch(`${base}/events.json${range}`),
      fetch(`${base}/tombstones.json${tombstoneRange}`),
    ])
    const evData = evRes.ok ? await evRes.json() : null
    const tbData = tbRes.ok ? await tbRes.json() : null
    // IDB auto-increment keys are numbers; Firebase JSON keys are strings — coerce back.
    const coerceId = id => (isNaN(Number(id)) ? id : Number(id))
    return {
      events: evData ? Object.values(evData) : [],
      tombstoneIds: tbData ? Object.keys(tbData).map(coerceId) : [],
      // Only handed back when both fetches succeeded; caller commits it with
      // commitPullCursor() AFTER the batch is durably applied to IDB — not
      // here. Advancing the cursor before that would mean a crash or a
      // localStorage write failure between "fetched" and "applied" loses the
      // batch forever, since the next pull would start after it.
      cursor: evRes.ok && tbRes.ok
        ? new Date(new Date(pullStartedAt).getTime() - SYNC_SAFETY_MARGIN_MS).toISOString()
        : null,
    }
  } catch {
    return { events: [], tombstoneIds: [] }
  }
}

// Persist the pull cursor. Call only after the pulled batch has been applied
// to IDB. Best-effort: a full localStorage must not lose the batch we just
// applied — losing only the cursor just means the next pull re-fetches a
// wider (still-correct, idempotent) range.
export function commitPullCursor(cursor) {
  if (!cursor) return
  try { localStorage.setItem(LAST_PULL_KEY, cursor) } catch { /* ignore quota */ }
}
