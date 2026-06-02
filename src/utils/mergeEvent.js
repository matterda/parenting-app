// Field-level merge of two copies of the same event (same id) coming from
// different devices. Used on BOTH pull and push so that concurrent enrichment
// of the same log — e.g. one phone creates a feed with null fields and another
// fills them in — keeps both contributions instead of one whole-object copy
// clobbering the other.
//
// Rules:
//  - The copy with the newer updated_at wins any field where BOTH set a value.
//  - A null/undefined value never overwrites a real value (gap-filling). This
//    favours preserving data over propagating an intentional "clear", which is
//    the safer tradeoff for this app — deliberately blanking an already-set
//    field will not sync, but accidental data loss is avoided.
//  - updated_at of the result is the newer of the two.
//  - The merge is deterministic and idempotent, so every device converges on
//    the same result regardless of arg order or how many times it runs.

export function mergeEvent(a, b) {
  if (!a) return b
  if (!b) return a
  const newer = pickNewer(a, b)
  const older = newer === a ? b : a
  const merged = fillMerge(newer, older)
  merged.updated_at = newer.updated_at ?? older.updated_at ?? null
  return merged
}

function pickNewer(a, b) {
  const ta = a.updated_at ?? ''
  const tb = b.updated_at ?? ''
  if (ta > tb) return a
  if (tb > ta) return b
  // Exact tie (same server ms) — break it deterministically so both devices
  // arrive at the same winner no matter the argument order.
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b
}

// Base = older copy; overlay the newer copy's real (non-null) values on top.
function fillMerge(newer, older) {
  const out = { ...older }
  for (const k of Object.keys(newer)) {
    const nv = newer[k]
    if (k === 'data' && isPlainObject(nv) && isPlainObject(older[k])) {
      out[k] = fillPlain(nv, older[k])
    } else if (nv !== null && nv !== undefined) {
      out[k] = nv
    } else if (!(k in out)) {
      out[k] = nv
    }
  }
  return out
}

function fillPlain(newer, older) {
  const out = { ...older }
  for (const k of Object.keys(newer)) {
    const nv = newer[k]
    if (nv !== null && nv !== undefined) out[k] = nv
    else if (!(k in out)) out[k] = nv
  }
  return out
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
