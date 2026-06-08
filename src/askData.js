// "Ask your data" — approach C: feed the model pre-computed (accurate)
// aggregates plus a compact recent raw log, and let it answer in prose. The
// model is told to trust the aggregates for counts/sums rather than tallying
// raw rows itself. The data blob is sent as a cached system block so follow-up
// questions in the same session are much cheaper.

import { toLocalISO } from './utils/time'
import { dailySeries, todayCounts, lastOfType, weightSeries } from './utils/aggregate'

const AGG_DAYS = 30
const RAW_DAYS = 21

function getBaby() {
  return {
    name: localStorage.getItem('baby_name') || 'baby',
    date_of_birth: localStorage.getItem('baby_dob') || null,
  }
}

// Compact, lossless-enough representation of one event for the raw log.
function compactEvent(e) {
  const d = e.data ?? {}
  const o = { time: e.timestamp_start, type: e.type }
  if (e.timestamp_end) o.end = e.timestamp_end
  for (const k of ['method', 'milk_type', 'side', 'volume_ml', 'duration_min', 'kind',
    'value', 'unit', 'name', 'dose', 'label', 'text', 'clothed', 'delta_g', 'volume_estimated', 'volume_source']) {
    if (d[k] != null) o[k] = d[k]
  }
  if (e.context_note) o.note = e.context_note
  return o
}

export function buildDataContext(events) {
  const extracted = events.filter(e => e.extracted)

  const lasts = {}
  for (const t of ['feed', 'sleep', 'diaper', 'pumping', 'weight', 'weighin', 'medication']) {
    const l = lastOfType(extracted, t)
    if (l) lasts[t] = compactEvent(l)
  }

  const rawCutoff = Date.now() - RAW_DAYS * 86_400_000
  const recent = extracted
    .filter(e => new Date(e.timestamp_start).getTime() >= rawCutoff)
    .sort((a, b) => (a.timestamp_start < b.timestamp_start ? -1 : 1))
    .map(compactEvent)

  return {
    baby: getBaby(),
    total_events_logged: extracted.length,
    today_counts: todayCounts(extracted),
    aggregate_window_days: AGG_DAYS,
    daily_aggregates: dailySeries(extracted, AGG_DAYS),
    weights: weightSeries(extracted),
    last_event_of_each_type: lasts,
    recent_raw_events_days: RAW_DAYS,
    recent_raw_events: recent,
  }
}

const SYSTEM_INSTRUCTIONS = `You answer a parent's questions about their baby's logged data, conversationally and concisely.

HOW TO USE THE DATA:
- The DATA block contains PRE-COMPUTED, ACCURATE aggregates: today_counts, daily_aggregates (per-day totals for the last N days — feeds and volumes by milk type, pumping, sleep hours, diapers), weights, and last_event_of_each_type. PREFER these for any count, sum, average or trend. Do NOT re-tally raw events by hand — you make arithmetic mistakes.
- recent_raw_events is the raw log for the most recent period, for specific recall ("when did we last…", "what time was the 2pm feed").
- All times are local ISO timestamps. Compute ages/durations from current_datetime.

FEED CATEGORIES in daily_aggregates: feedsBreast* = direct breastfeeding, feedsBottleBreastmilk* = bottle of expressed milk, feedsBottleFormula* = bottle of formula. Volumes are in ml; sleep in hours; pumpingsBreasts counts breasts pumped (both = 2).

IMPORTANT GAPS — be honest, never invent:
- Direct breastfeeds often have NO recorded volume; some are estimated by weighing (volume_estimated/volume_source:"weighed"). So total milk intake may be undercounted. Say so when relevant.
- If the data doesn't contain the answer, say what's missing rather than guessing.

STYLE & LIMITS:
- Be specific: give numbers and dates. Lead with the answer, then brief support.
- You DESCRIBE data only. No medical advice, diagnosis, or judgments of normal/concerning. If asked a health question, say you can't assess it and suggest noting it for the pediatrician.`

export async function askQuestion({ question, history = [], events }) {
  const apiKey = localStorage.getItem('anthropic_api_key')
  if (!apiKey) throw new Error('No API key — add it in Settings.')
  const model = localStorage.getItem('anthropic_model') || 'claude-sonnet-4-6'

  const dataBlock = JSON.stringify({
    current_datetime: toLocalISO(new Date()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...buildDataContext(events),
  })

  const messages = [
    ...history.flatMap(h => [
      { role: 'user', content: h.q },
      { role: 'assistant', content: h.a },
    ]),
    { role: 'user', content: question },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: [
        { type: 'text', text: SYSTEM_INSTRUCTIONS },
        { type: 'text', text: 'DATA:\n' + dataBlock, cache_control: { type: 'ephemeral' } },
      ],
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API error ${response.status}`)
  }
  const body = await response.json()
  return body.content?.[0]?.text ?? ''
}
