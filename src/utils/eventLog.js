// Append-only operation log — a git-like history of every mutation to the
// events store. Stored locally in IndexedDB (object store `event_log`), so it
// survives accidental or malicious wipes of the remote Firebase database.
//
// Each entry: { seq, ts, op, id, before, after, source }
//   seq    — monotonic auto-increment key (local ordering)
//   ts     — ISO timestamp the entry was recorded
//   op     — 'create' | 'update' | 'delete'
//   id     — the event id this op concerns
//   before — full event snapshot before the op (null for create)
//   after  — full event snapshot after the op (null for delete)
//   source — 'user' (a direct action on this device) | 'sync' (pulled from remote)
//
// The log is never pruned (retention: keep everything). Compaction can be
// added later if size becomes a concern.

import { getDB, LOG_STORE } from '../db'

// Record a single mutation. Failures here must never break the actual write,
// so everything is wrapped defensively.
export async function appendLog({ op, id, before = null, after = null, source = 'user' }) {
  try {
    const db = await getDB()
    await db.add(LOG_STORE, {
      ts: new Date().toISOString(),
      op,
      id,
      before,
      after,
      source,
    })
  } catch (err) {
    // Logging is best-effort; don't surface errors to the caller.
    console.warn('eventLog.appendLog failed', err)
  }
}

// All log entries in seq order (oldest → newest).
export async function getLog() {
  const db = await getDB()
  return db.getAll(LOG_STORE)
}

// Number of entries in the log.
export async function getLogCount() {
  const db = await getDB()
  return db.count(LOG_STORE)
}

// Reconstruct the full set of events as it existed at a given point in time.
// `untilSeq` is inclusive; pass Infinity (default) to replay the entire log.
// Returns an array of event records (current/live ones only — deleted events
// are absent).
export async function reconstructAt(untilSeq = Infinity) {
  const log = await getLog()
  const state = new Map()
  for (const entry of log) {
    if (entry.seq > untilSeq) break
    if (entry.op === 'delete') {
      state.delete(entry.id)
    } else {
      // create or update — `after` is the authoritative snapshot
      if (entry.after) state.set(entry.id, entry.after)
    }
  }
  return [...state.values()]
}

// List of distinct "restore points" — one per log entry, newest first, with
// the reconstructed event count at that point. Used by the audit/time-travel UI.
export async function listRestorePoints() {
  const log = await getLog()
  const state = new Map()
  const points = []
  for (const entry of log) {
    if (entry.op === 'delete') state.delete(entry.id)
    else if (entry.after) state.set(entry.id, entry.after)
    points.push({
      seq: entry.seq,
      ts: entry.ts,
      op: entry.op,
      id: entry.id,
      source: entry.source,
      count: state.size,
    })
  }
  return points.reverse()
}

// Export the entire operation log as a JSON string (for offsite backup).
export async function exportLog() {
  const log = await getLog()
  return JSON.stringify(log, null, 2)
}

// Undo the most recent N operations by computing the state before them and
// returning it. This does NOT mutate the DB; the caller is responsible for
// applying the returned event set (so it can route through the normal restore
// path and re-log the change). Returns the reconstructed event array.
export async function stateBeforeLastN(n) {
  const log = await getLog()
  if (log.length === 0) return []
  const cutoffIndex = Math.max(0, log.length - n)
  // Replay everything strictly before the cutoff entry.
  const state = new Map()
  for (let i = 0; i < cutoffIndex; i++) {
    const entry = log[i]
    if (entry.op === 'delete') state.delete(entry.id)
    else if (entry.after) state.set(entry.id, entry.after)
  }
  return [...state.values()]
}
