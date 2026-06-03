// Local rolling snapshots stored in localStorage.
// Kept as a ring buffer of MAX_SNAPSHOTS entries, each with a timestamp and
// the full events array serialised as JSON.  Protects against accidental
// Firebase wipes, bulk deletes, or app bugs.

const KEY = 'baby_log_snapshots'
const MAX_SNAPSHOTS = 10

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(snapshots) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshots))
  } catch {
    // localStorage quota exceeded — drop the oldest and try once more
    const trimmed = snapshots.slice(-Math.floor(MAX_SNAPSHOTS / 2))
    try { localStorage.setItem(KEY, JSON.stringify(trimmed)) } catch { /* give up */ }
  }
}

// Latest updated_at across all events — changes whenever any event is edited,
// even if the count and newest id stay the same.
function editSignature(events) {
  let max = ''
  for (const e of events) {
    if (e.updated_at && e.updated_at > max) max = e.updated_at
  }
  return max
}

// Save the current events array as a new snapshot (auto-deduplicates if events
// haven't changed since the last save).
export function saveSnapshot(events) {
  if (!events || events.length === 0) return
  const snapshots = load()
  const sig = editSignature(events)

  // Skip if identical to the most recent snapshot. Count + newest id catch
  // adds/deletes; the edit signature catches in-place edits.
  const last = snapshots[snapshots.length - 1]
  if (last && last.count === events.length && last.lastId === events[0]?.id && last.sig === sig) return

  snapshots.push({
    savedAt: new Date().toISOString(),
    count: events.length,
    lastId: events[0]?.id ?? null, // events are reverse-chrono, so [0] is newest
    sig,
    data: events,
  })

  // Keep only the most recent MAX_SNAPSHOTS
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS)

  save(snapshots)
}

// Return snapshot metadata list (no data) for display in Settings.
export function listSnapshots() {
  return load().map(({ savedAt, count }, i) => ({ savedAt, count, index: i })).reverse()
}

// Return the full events array for a given snapshot index.
export function getSnapshotData(index) {
  return load()[index]?.data ?? []
}

// ── Daily compressed snapshots ────────────────────────────────────────────
// A separate, longer-horizon backup: at most one snapshot per local calendar
// day, kept for the last MAX_DAILY days. The full events array is gzip-
// compressed (when the browser supports CompressionStream) and stored base64,
// so 30 days of history stays well within the localStorage quota.

const DAILY_KEY = 'baby_log_daily_snapshots'
const MAX_DAILY = 30

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadDaily() {
  try { return JSON.parse(localStorage.getItem(DAILY_KEY) ?? '[]') } catch { return [] }
}

function saveDaily(list) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(list))
  } catch {
    const trimmed = list.slice(-Math.floor(MAX_DAILY / 2))
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(trimmed)) } catch { /* give up */ }
  }
}

function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function gzip(str) {
  if (typeof CompressionStream === 'undefined') return null
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(str))
  writer.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return bytesToBase64(new Uint8Array(buf))
}

async function gunzip(b64) {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(base64ToBytes(b64))
  writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new TextDecoder().decode(buf)
}

// Save (or refresh) today's daily snapshot. Called on launch and after edits;
// it keeps one record per calendar day, updating it through the day so the
// retained copy reflects the latest state.
export async function saveDailySnapshot(events) {
  if (!events || events.length === 0) return
  const list = loadDaily()
  const day = localDayKey()
  const json = JSON.stringify(events)
  const gz = await gzip(json)
  const record = gz
    ? { savedAt: new Date().toISOString(), day, count: events.length, gz }
    : { savedAt: new Date().toISOString(), day, count: events.length, data: events }

  const idx = list.findIndex(s => s.day === day)
  if (idx >= 0) list[idx] = record
  else list.push(record)

  list.sort((a, b) => (a.day < b.day ? -1 : 1))
  if (list.length > MAX_DAILY) list.splice(0, list.length - MAX_DAILY)
  saveDaily(list)
}

// Metadata list (newest first) for display in Settings.
export function listDailySnapshots() {
  return loadDaily().map((s, i) => ({ savedAt: s.savedAt, day: s.day, count: s.count, index: i })).reverse()
}

// Full events array for a given daily snapshot index (decompresses if needed).
export async function getDailySnapshotData(index) {
  const rec = loadDaily()[index]
  if (!rec) return []
  if (rec.data) return rec.data
  if (rec.gz) { try { return JSON.parse(await gunzip(rec.gz)) } catch { return [] } }
  return []
}
