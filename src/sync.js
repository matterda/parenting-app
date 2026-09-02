// Firebase Realtime Database sync.
// Events stored as object keyed by event ID: { [id]: event }
// Tombstones stored at /tombstones/{id} = deletedAt ISO string
// Both devices push on every write and pull on open / visibilitychange.

import { mergeEvent, sameEvent } from './utils/mergeEvent'
import { setServerOffset } from './utils/serverTime'

export function getSyncUrl() {
  return (localStorage.getItem('firebase_sync_url') ?? '').replace(/\/$/, '')
}

// Incremental pulls are keyed on `synced_at` — a SERVER-assigned arrival time
// stamped by Firebase on every push (see SERVER_TS below) — not on the
// event's own `updated_at`.
//
// `updated_at` is stamped by the writing phone when the user makes the edit,
// which is not when the write reaches Firebase. A phone that logs offline, or
// gets backgrounded mid-push and only retries on next app open, lands a write
// whose updated_at is minutes-to-days old. The other phone's cursor is long
// past that point, so the write is never pulled — lost forever. Server arrival
// time can't drift like that: it's assigned as the write commits, by one clock.
//
// Cursor is a number (server epoch ms). New localStorage key on purpose: every
// device does one full pull on first run with this code, which also repairs
// whatever the updated_at cursor already skipped.
const SYNC_CURSOR_KEY = 'sync_cursor_ms'

const SERVER_TS = { '.sv': 'timestamp' }

// Two writes committing at nearly the same moment can be observed out of
// order, so trail the cursor behind the newest arrival we've seen. Re-fetched
// events merge as no-ops, so overlap is free; missing one is not.
const SYNC_SAFETY_MARGIN_MS = 5 * 60 * 1000

// Forget the incremental-pull cursor, forcing the next syncPull to fetch full
// history. Call this whenever the sync URL changes — a cursor from a
// different Firebase project means nothing here.
export function resetSyncCursor() {
  localStorage.removeItem(SYNC_CURSOR_KEY)
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
      updates[key] = { ...ev, synced_at: SERVER_TS }
      continue
    }
    // Field-level merge with the remote copy so we neither clobber a newer
    // remote edit nor drop fields the remote doesn't have yet. Only write if
    // the merge actually changes the remote value — a needless write would
    // restamp synced_at and show up as "new" on the other phone.
    const merged = mergeEvent(ev, remoteEv)
    merged.id = ev.id
    if (!sameEvent(merged, remoteEv)) updates[key] = { ...merged, synced_at: SERVER_TS }
  }
  if (Object.keys(updates).length === 0) return

  try {
    await fetch(`${base}/events.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  } catch { /* offline or backgrounded mid-request — retried on next app open */ }
}

// Delete a single event from Firebase and record a tombstone.
// The tombstone's value is the server-assigned arrival time, matching events'
// synced_at — incremental pulls filter tombstones by this value, so it has to
// share the cursor's clock basis or a delete that lands late (offline phone,
// killed request) falls outside the other device's window and never syncs.
export async function syncDelete(id) {
  const base = getSyncUrl()
  if (!base) return
  await Promise.all([
    fetch(`${base}/events/${id}.json`, { method: 'DELETE' }),
    fetch(`${base}/tombstones/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SERVER_TS),
    }),
  ])
}

function rangeQuery(orderBy, since) {
  if (!since) return ''
  return `?${new URLSearchParams({ orderBy: JSON.stringify(orderBy), startAt: String(since) })}`
}

// Fetch events + tombstones at or after `since` (server arrival ms), or all of
// history when `since` is falsy.
//
// A failed range query used to be indistinguishable from "nothing changed":
// non-ok responses became empty arrays and a null cursor, so the app happily
// reported a successful, empty sync forever. RTDB REST rejects an ordered
// query with 400 unless the field is indexed, which is exactly the kind of
// server-side config problem that produces that silence. So: if a ranged
// request fails, say so and retry the whole thing unranged. Slower beats wrong.
async function fetchSince(base, since) {
  const get = s => Promise.all([
    fetch(`${base}/events.json${rangeQuery('synced_at', s)}`),
    fetch(`${base}/tombstones.json${rangeQuery('$value', s)}`),
  ])
  let [evRes, tbRes] = await get(since)
  if (since && (!evRes.ok || !tbRes.ok)) {
    console.warn('syncPull: incremental query failed, falling back to full pull.',
      'Add \'".indexOn": "synced_at"\' to the /events rules (and \'".indexOn": ".value"\' to /tombstones).',
      evRes.status, tbRes.status)
    ;[evRes, tbRes] = await get(null)
    since = null
  }
  return { evRes, tbRes, since }
}

// Pull remote events + tombstones that ARRIVED in Firebase since our cursor
// (full history the first time, or after resetSyncCursor). Filtering on
// arrival — rather than on `timestamp_start` — is what makes an edit to an old
// entry (yesterday's feed corrected today) show up at all.
// Returns { events, tombstoneIds, cursor }
export async function syncPull() {
  const base = getSyncUrl()
  if (!base) return { events: [], tombstoneIds: [] }
  try {
    const { evRes, tbRes, since } = await fetchSince(base, Number(localStorage.getItem(SYNC_CURSOR_KEY)) || 0)
    const evData = evRes.ok ? await evRes.json() : null
    const tbData = tbRes.ok ? await tbRes.json() : null
    // IDB auto-increment keys are numbers; Firebase JSON keys are strings — coerce back.
    const coerceId = id => (isNaN(Number(id)) ? id : Number(id))

    // Advance only to the newest arrival we actually received, so the cursor
    // can never step over data we haven't seen. Pre-migration records have no
    // synced_at (and pre-migration tombstones hold an ISO string): they
    // contribute nothing here, so until each phone makes one write we simply
    // keep doing full pulls. Self-healing, and the safe direction to fail.
    let newest = 0
    for (const ev of Object.values(evData ?? {})) {
      if (typeof ev?.synced_at === 'number' && ev.synced_at > newest) newest = ev.synced_at
    }
    for (const v of Object.values(tbData ?? {})) {
      if (typeof v === 'number' && v > newest) newest = v
    }

    return {
      // synced_at is remote bookkeeping — keep it out of the local store so it
      // never leaks into merges or the event log.
      events: Object.values(evData ?? {}).map(({ synced_at, ...ev }) => ev),
      // On an incremental pull, skip pre-migration string tombstones: RTDB
      // sorts strings after all numbers, so a numeric startAt matches every
      // one of them on every pull. They were already applied by the full pull
      // that necessarily preceded any incremental one.
      tombstoneIds: Object.entries(tbData ?? {})
        .filter(([, v]) => !since || typeof v === 'number')
        .map(([id]) => coerceId(id)),
      // Only handed back when both fetches succeeded; caller commits it with
      // commitPullCursor() AFTER the batch is durably applied to IDB — not
      // here. Advancing the cursor before that would mean a crash or a
      // localStorage write failure between "fetched" and "applied" loses the
      // batch forever, since the next pull would start after it.
      cursor: evRes.ok && tbRes.ok && newest
        ? Math.max(0, newest - SYNC_SAFETY_MARGIN_MS)
        : null,
    }
  } catch {
    return { events: [], tombstoneIds: [] }
  }
}

// Persist the pull cursor. Call only after the pulled batch has been applied
// to IDB. Monotonic — a trailing safety margin must never walk the cursor
// backwards over and over. Best-effort: a full localStorage must not lose the
// batch we just applied; losing only the cursor just means the next pull
// re-fetches a wider (still-correct, idempotent) range.
export function commitPullCursor(cursor) {
  if (!cursor) return
  try {
    const prev = Number(localStorage.getItem(SYNC_CURSOR_KEY)) || 0
    if (cursor > prev) localStorage.setItem(SYNC_CURSOR_KEY, String(cursor))
  } catch { /* ignore quota */ }
}
