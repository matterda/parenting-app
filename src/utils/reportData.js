// Aggregates raw events into the compact summary object sent to the report LLM.
// Keeps the token count low while giving the model everything it needs.

function localDayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function eventsInWindow(events, fromDate, toDate) {
  const from = fromDate.getTime()
  const to   = toDate.getTime()
  return events.filter(e => {
    if (!e.extracted || !e.timestamp_start) return false
    const t = new Date(e.timestamp_start).getTime()
    return t >= from && t <= to
  })
}

function feedSummary(evs) {
  const feeds = evs.filter(e => e.type === 'feed')
  if (!feeds.length) return null
  const totalVol = feeds.reduce((s, e) => s + (Number(e.data?.volume_ml) || 0), 0)
  const withVol  = feeds.filter(e => e.data?.volume_ml != null).length
  const methods  = {}
  for (const e of feeds) {
    let m = e.data?.method === 'breast' ? 'breast'
          : e.data?.milk_type === 'breast_milk' ? 'bottle_expressed'
          : e.data?.milk_type === 'formula' ? 'formula'
          : 'bottle_unknown'
    methods[m] = (methods[m] || 0) + 1
  }
  return {
    count: feeds.length,
    total_volume_ml: totalVol,
    avg_volume_ml: withVol ? Math.round(totalVol / withVol) : null,
    methods,
  }
}

function sleepSummary(evs) {
  const sleeps = evs.filter(e => e.type === 'sleep')
  if (!sleeps.length) return null
  let totalMs = 0
  let completed = 0
  for (const e of sleeps) {
    if (e.timestamp_end) {
      const dur = new Date(e.timestamp_end) - new Date(e.timestamp_start)
      if (dur > 0) { totalMs += dur; completed++ }
    }
  }
  return {
    sessions: sleeps.length,
    completed_sessions: completed,
    total_hours: Math.round((totalMs / 3_600_000) * 10) / 10,
  }
}

function diaperSummary(evs) {
  const diapers = evs.filter(e => e.type === 'diaper')
  if (!diapers.length) return null
  return {
    total: diapers.length,
    pee:  diapers.filter(e => e.data?.kind === 'wet'   || e.data?.kind === 'both').length,
    poo:  diapers.filter(e => e.data?.kind === 'dirty' || e.data?.kind === 'both').length,
  }
}

function pumpingSummary(evs) {
  const pumps = evs.filter(e => e.type === 'pumping')
  if (!pumps.length) return null
  const totalVol = pumps.reduce((s, e) => s + (Number(e.data?.volume_ml) || 0), 0)
  return {
    sessions: pumps.length,
    total_volume_ml: totalVol,
    avg_volume_ml: totalVol ? Math.round(totalVol / pumps.length) : null,
  }
}

function weightReadings(evs) {
  return evs
    .filter(e => e.type === 'weight' && e.data?.value != null)
    .sort((a, b) => new Date(a.timestamp_start) - new Date(b.timestamp_start))
    .map(e => ({
      date: new Date(e.timestamp_start).toLocaleDateString(),
      value: e.data.value,
      unit: e.data.unit ?? 'kg',
    }))
}

function temperatureReadings(evs) {
  return evs
    .filter(e => e.type === 'temperature' && e.data?.value != null)
    .sort((a, b) => new Date(a.timestamp_start) - new Date(b.timestamp_start))
    .map(e => ({
      date: new Date(e.timestamp_start).toLocaleDateString(),
      value: e.data.value,
      unit: e.data.unit ?? 'C',
    }))
}

function medicationList(evs) {
  return evs
    .filter(e => e.type === 'medication' && e.data?.name)
    .map(e => ({
      date: new Date(e.timestamp_start).toLocaleDateString(),
      name: e.data.name,
      dose: e.data.dose ?? null,
    }))
}

function contextNotes(evs) {
  return evs
    .filter(e => e.context_note && e.context_note.trim())
    .map(e => ({
      date: new Date(e.timestamp_start).toLocaleDateString(),
      type: e.type,
      note: e.context_note.trim(),
    }))
}

function pediatricianQuestions(evs) {
  return evs
    .filter(e => e.type === 'question_for_pediatrician')
    .map(e => e.raw_text ?? e.context_note ?? '(no text)')
}

function windowSummary(events, fromDate, toDate) {
  const evs = eventsInWindow(events, fromDate, toDate)
  const days = Math.round((toDate - fromDate) / 86_400_000)
  return {
    days,
    from: fromDate.toLocaleDateString(),
    to:   toDate.toLocaleDateString(),
    feeds:    feedSummary(evs),
    sleep:    sleepSummary(evs),
    diapers:  diaperSummary(evs),
    pumping:  pumpingSummary(evs),
    weight:   weightReadings(evs),
    temperature: temperatureReadings(evs),
    medications: medicationList(evs),
    context_notes: contextNotes(evs),
    questions_for_pediatrician: pediatricianQuestions(evs),
  }
}

// Returns { current, prior } summaries for the report prompt.
export function buildReportData(events, windowDays) {
  const now     = new Date()
  const curFrom = new Date(now); curFrom.setDate(now.getDate() - windowDays)
  const priFrom = new Date(curFrom); priFrom.setDate(curFrom.getDate() - windowDays)

  return {
    current: windowSummary(events, curFrom, now),
    prior:   windowSummary(events, priFrom, curFrom),
  }
}
