// Pure aggregation helpers over extracted events. Descriptive only — no judgments.

function localDayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameLocalDay(iso, ref) {
  return localDayKey(iso) === localDayKey(ref.toISOString())
}

export function lastOfType(events, type) {
  return events
    .filter(e => e.extracted && e.type === type)
    .sort((a, b) => (a.timestamp_start < b.timestamp_start ? 1 : -1))[0] ?? null
}

export function todayCounts(events) {
  const now = new Date()
  const today = events.filter(e => e.extracted && isSameLocalDay(e.timestamp_start, now))
  return {
    feed: today.filter(e => e.type === 'feed').length,
    sleep: today.filter(e => e.type === 'sleep').length,
    diaper: today.filter(e => e.type === 'diaper').length,
    pumping: today.filter(e => e.type === 'pumping').length,
  }
}

// Returns the last `days` local days (oldest → newest) with per-day aggregates.
export function dailySeries(events, days = 7) {
  const series = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now)
    day.setDate(now.getDate() - i)
    const key = localDayKey(day.toISOString())

    // Local-day window [00:00, next-day 00:00) for splitting overnight sleeps.
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1)

    const dayEvents = events.filter(e => e.extracted && localDayKey(e.timestamp_start) === key)

    const isDiaper = e => e.type === 'diaper'
    const feedEvents = dayEvents.filter(e => e.type === 'feed')
    const pumpEvents = dayEvents.filter(e => e.type === 'pumping')
    const breastFeeds  = feedEvents.filter(e => feedMilkCategory(e) === 'breast')
    const formulaFeeds = feedEvents.filter(e => feedMilkCategory(e) === 'formula')
    const otherFeeds   = feedEvents.filter(e => feedMilkCategory(e) === 'other')
    const volSum = arr => arr.reduce((s, e) => s + (Number(e.data?.volume_ml) || 0), 0)
    series.push({
      key,
      label: day.toLocaleDateString([], { weekday: 'short' }),
      feeds: feedEvents.length,
      feedsVolumeMl: feedEvents.reduce((s, e) => s + (Number(e.data?.volume_ml) || 0), 0),
      // Feeds split by milk type (counts + volume where known)
      feedsBreast: breastFeeds.length,
      feedsFormula: formulaFeeds.length,
      feedsOther: otherFeeds.length,
      feedsBreastMl: volSum(breastFeeds),
      feedsFormulaMl: volSum(formulaFeeds),
      feedsOtherMl: volSum(otherFeeds),
      pumpings: pumpEvents.length,
      pumpingsVolumeMl: pumpEvents.reduce((s, e) => s + (Number(e.data?.volume_ml) || 0), 0),
      // pee = wet-only + both; poo = dirty-only + both
      diapersPee: dayEvents.filter(e => isDiaper(e) && (e.data?.kind === 'wet' || e.data?.kind === 'both')).length,
      diapersPoo: dayEvents.filter(e => isDiaper(e) && (e.data?.kind === 'dirty' || e.data?.kind === 'both')).length,
      // Sleep is counted by overlap with this day, so an overnight sleep is
      // split across the two days it spans (not dumped onto the start day).
      sleepHours: sleepOverlapHours(events, dayStart.getTime(), dayEnd.getTime()),
    })
  }
  return series
}

// Classify a feed event by milk type:
//   'breast'  — fed directly at the breast, or a bottle of expressed breast milk
//   'formula' — a bottle of formula
//   'other'   — milk type not recorded (or 'mixed')
export function feedMilkCategory(e) {
  const d = e.data ?? {}
  if (d.method === 'breast') return 'breast'
  if (d.milk_type === 'breast_milk') return 'breast'
  if (d.milk_type === 'formula') return 'formula'
  return 'other'
}

// Total hours of completed sleep that fall within the [dayStartMs, dayEndMs)
// window. Each sleep interval is clipped to the window, so a sleep crossing
// midnight contributes only its portion to each day.
function sleepOverlapHours(events, dayStartMs, dayEndMs) {
  let ms = 0
  for (const e of events) {
    if (!e.extracted || e.type !== 'sleep' || !e.timestamp_start || !e.timestamp_end) continue
    const s = new Date(e.timestamp_start).getTime()
    const en = new Date(e.timestamp_end).getTime()
    if (!(en > s)) continue
    const lo = Math.max(s, dayStartMs)
    const hi = Math.min(en, dayEndMs)
    if (hi > lo) ms += hi - lo
  }
  return Math.round((ms / 3_600_000) * 10) / 10
}

const TO_KG = { kg: 1, g: 0.001, lb: 0.453592, oz: 0.028350 }

// Returns all weight readings sorted oldest → newest (for plotting).
// valueKg normalises to kg for bar scaling; value+unit are kept for display.
export function weightSeries(events) {
  return events
    .filter(e => e.extracted && e.type === 'weight' && e.data?.value != null)
    .sort((a, b) => (a.timestamp_start < b.timestamp_start ? -1 : 1))
    .map(e => {
      const unit = e.data.unit ?? 'kg'
      const value = Number(e.data.value)
      return {
        key: e.id,
        date: new Date(e.timestamp_start).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        value,
        unit,
        valueKg: value * (TO_KG[unit] ?? 1),
      }
    })
}

// Recent (default last 24h) extracted events that are missing details worth
// filling in. Returns [{ event, reasons[] }] newest-first. Notes/milestones
// and legitimately-empty fields (e.g. a breast feed has no volume) are not
// flagged. Only concrete missing fields are flagged — the model's
// needs_confirmation hints are intentionally ignored (too noisy, e.g. it tags
// the end time on every completed sleep).
export function incompleteEvents(events, withinHours = 24) {
  const cutoff = Date.now() - withinHours * 3_600_000
  const out = []

  for (const e of events) {
    if (!e.extracted || !e.timestamp_start) continue
    if (new Date(e.timestamp_start).getTime() < cutoff) continue

    const d = e.data ?? {}
    const reasons = []

    if (e.type === 'feed') {
      if (!d.method) reasons.push('feed type')
      else if (d.method === 'bottle') {
        if (d.volume_ml == null) reasons.push('volume')
        if (!d.milk_type) reasons.push('milk type')
      }
    } else if (e.type === 'pumping') {
      if (d.volume_ml == null) reasons.push('volume')
      if (d.duration_min == null) reasons.push('duration')
    } else if (e.type === 'diaper') {
      if (!d.kind) reasons.push('wet/dirty')
    }

    if (reasons.length > 0) out.push({ event: e, reasons })
  }

  out.sort((a, b) => new Date(b.event.timestamp_start) - new Date(a.event.timestamp_start))
  return out
}

export function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
