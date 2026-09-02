// Self-check for the sync bits that are easy to get subtly wrong.
// Run: node src/sync.check.mjs
import assert from 'node:assert/strict'
import { mergeEvent, sameEvent } from './utils/mergeEvent.js'

// sameEvent ignores key order (local db.js order vs RTDB's sorted keys), so a
// no-op merge doesn't read as a change and restamp synced_at → ping-pong.
assert.ok(sameEvent({ a: 1, b: 2 }, { b: 2, a: 1 }))
assert.ok(sameEvent({ data: { x: 1, y: null } }, { data: { y: null, x: 1 } }))
assert.ok(!sameEvent({ a: 1 }, { a: 2 }))
assert.ok(!sameEvent({ a: 1 }, { a: 1, b: 1 }))
assert.ok(sameEvent({ l: [1, { p: 1, q: 2 }] }, { l: [1, { q: 2, p: 1 }] }))
assert.ok(!sameEvent({ l: [1, 2] }, { l: [2, 1] })) // array order is meaningful

// A merge that only gap-fills the remote copy must register as a change.
const local = { id: 'x', updated_at: '2026-09-01T10:00:00Z', data: { ml: 90 } }
const remote = { data: { ml: null }, id: 'x', updated_at: '2026-09-01T09:00:00Z' }
const merged = mergeEvent(local, remote)
assert.equal(merged.data.ml, 90)
assert.ok(!sameEvent(merged, remote))
// ...and re-merging the result is a no-op (idempotent → converges, no churn).
assert.ok(sameEvent(mergeEvent(local, merged), merged))

console.log('sync.check: ok')
