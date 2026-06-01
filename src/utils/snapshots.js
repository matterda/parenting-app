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

// Save the current events array as a new snapshot (auto-deduplicates if events
// haven't changed since the last save).
export function saveSnapshot(events) {
  if (!events || events.length === 0) return
  const snapshots = load()

  // Skip if identical to the most recent snapshot (compare by count + last id)
  const last = snapshots[snapshots.length - 1]
  if (last && last.count === events.length && last.lastId === events[0]?.id) return

  snapshots.push({
    savedAt: new Date().toISOString(),
    count: events.length,
    lastId: events[0]?.id ?? null, // events are reverse-chrono, so [0] is newest
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
