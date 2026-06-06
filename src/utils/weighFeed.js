// Weighed-feed volume estimation ("test weighing").
//
// The baby is weighed clothed/diapered (a "weighin" event) whenever convenient.
// Between two consecutive weighins, if the ONLY mass-changing event was direct
// breastfeeding, the weight delta (grams) equals the milk consumed (1 g ≈ 1 ml).
// Anything else that changes the baby+clothes+diaper mass invalidates the pair.

export const BASELINE_MAX_AGE_MS = 3 * 60 * 60 * 1000 // 3 h

const TO_G = { kg: 1000, g: 1, lb: 453.592, oz: 28.3495 }

export function gramsOf(value, unit) {
  return Number(value) * (TO_G[unit] ?? 1000)
}

const round5 = x => Math.round(x / 5) * 5

// Does an event occurring between two weighins break the measurement?
//   - diaper (always a change here) → removes accumulated output
//   - any feed that isn't a direct breastfeed (bottle/formula/expressed) → adds mass
//   - a real undressed weight reading → different clothing state
// Direct breastfeeds are the thing we measure (never invalidate). Sleep,
// pumping, temperature, medication, notes, milestones don't change mass.
export function invalidatesWeighPair(e) {
  if (!e.extracted) return false
  if (e.type === 'diaper') return true
  if (e.type === 'weight') return true
  if (e.type === 'feed') return e.data?.method !== 'breast'
  return false
}

const isWeighin = e => e.extracted && e.type === 'weighin' && e.data?.value != null
const isBreastfeed = e => e.extracted && e.type === 'feed' && e.data?.method === 'breast'
const ts = e => new Date(e.timestamp_start).getTime()

// Given all events and a closing weighin, find the matching prior baseline and
// compute per-feed estimates. Returns one of:
//   { status:'baseline' }                       — no prior weighin; just a baseline
//   { status:'expired', ageMs }                 — prior weighin older than 3 h
//   { status:'invalid', reason, atMs }          — an invalidating event in between
//   { status:'no_feed', deltaG, baselineId }    — clean pair but no breastfeed (drift)
//   { status:'ok', deltaG, baselineId, feeds:[{id, volume_ml, split}], multi }
export function computeWeighEstimate(events, afterWeighin) {
  const t2 = ts(afterWeighin)
  const priors = events.filter(e => isWeighin(e) && e.id !== afterWeighin.id && ts(e) < t2)
  if (priors.length === 0) return { status: 'baseline' }
  const baseline = priors.sort((a, b) => ts(b) - ts(a))[0]
  const t1 = ts(baseline)

  if (t2 - t1 > BASELINE_MAX_AGE_MS) return { status: 'expired', ageMs: t2 - t1 }

  const between = events.filter(e => ts(e) > t1 && ts(e) < t2)
  const blocker = between.find(invalidatesWeighPair)
  if (blocker) return { status: 'invalid', reason: blocker.type, atMs: ts(blocker) }

  const feeds = between.filter(isBreastfeed).sort((a, b) => ts(a) - ts(b))
  const deltaG = gramsOf(afterWeighin.data.value, afterWeighin.data.unit) -
                 gramsOf(baseline.data.value, baseline.data.unit)

  if (feeds.length === 0) return { status: 'no_feed', deltaG, baselineId: baseline.id }

  // Split the total delta across feeds by duration (even split if durations
  // unknown). Negative/zero deltas yield no positive volume (kept raw on the
  // weighin record instead) so they don't bias the per-feed numbers.
  const multi = feeds.length > 1
  let perFeed
  if (deltaG <= 0) {
    perFeed = feeds.map(f => ({ id: f.id, volume_ml: null, split: multi }))
  } else {
    const durs = feeds.map(f => Number(f.data?.duration_min) || 0)
    const sumDur = durs.reduce((s, x) => s + x, 0)
    perFeed = feeds.map((f, i) => {
      const share = sumDur > 0 ? durs[i] / sumDur : 1 / feeds.length
      return { id: f.id, volume_ml: round5(deltaG * share), split: multi }
    })
  }

  return { status: 'ok', deltaG, baselineId: baseline.id, feeds: perFeed, multi }
}

// Current baseline status for the Log-tab banner, evaluated as of `now`.
//   { state:'none' }
//   { state:'valid', weighin, expiresInMs }
//   { state:'expired', weighin }
//   { state:'invalidated', weighin, reason, atMs }
export function baselineStatus(events, now = Date.now()) {
  const weighins = events.filter(isWeighin).sort((a, b) => ts(b) - ts(a))
  if (weighins.length === 0) return { state: 'none' }
  const w = weighins[0]
  const tW = ts(w)

  const blocker = events.filter(e => ts(e) > tW && ts(e) <= now).find(invalidatesWeighPair)
  if (blocker) return { state: 'invalidated', weighin: w, reason: blocker.type, atMs: ts(blocker) }
  if (now - tW > BASELINE_MAX_AGE_MS) return { state: 'expired', weighin: w }
  return { state: 'valid', weighin: w, expiresInMs: BASELINE_MAX_AGE_MS - (now - tW) }
}
