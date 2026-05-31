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

    const dayEvents = events.filter(e => e.extracted && localDayKey(e.timestamp_start) === key)

    const isDiaper = e => e.type === 'diaper'
    series.push({
      key,
      label: day.toLocaleDateString([], { weekday: 'short' }),
      feeds: dayEvents.filter(e => e.type === 'feed').length,
      // pee = wet-only + both; poo = dirty-only + both
      diapersPee: dayEvents.filter(e => isDiaper(e) && (e.data?.kind === 'wet' || e.data?.kind === 'both')).length,
      diapersPoo: dayEvents.filter(e => isDiaper(e) && (e.data?.kind === 'dirty' || e.data?.kind === 'both')).length,
      sleepHours: totalSleepHours(dayEvents),
    })
  }
  return series
}

// Sum of completed sleep durations (events with both start and end) for a day's events.
function totalSleepHours(dayEvents) {
  let ms = 0
  for (const e of dayEvents) {
    if (e.type === 'sleep' && e.timestamp_start && e.timestamp_end) {
      const dur = new Date(e.timestamp_end) - new Date(e.timestamp_start)
      if (dur > 0) ms += dur
    }
  }
  return Math.round((ms / 3_600_000) * 10) / 10
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
