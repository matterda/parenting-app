const BABY = {
  name: 'baby name',
  date_of_birth: '2025-01-01' // placeholder — update with real DOB
}

const SYSTEM_PROMPT = `You convert a parent's free-text or dictated note about their baby into structured log events.

CONTEXT YOU RECEIVE:
- current_datetime (ISO 8601 in the user's local time with UTC offset)
- timezone (IANA name, e.g. "Europe/Rome" — use this to resolve ambiguous times)
- baby: { name, date_of_birth }
- active_sleep_since: ISO timestamp if the baby is currently sleeping (no end recorded yet), or null
- the parent's raw note

YOUR JOB:
1. Extract every loggable event into the schema below. One note may contain several.
2. Resolve relative and vague times against current_datetime ("an hour ago", "at 3", "last night", "this morning"). When a time is genuinely ambiguous (am vs pm, today vs yesterday, a bare number), pick the most likely reading AND add the field to needs_confirmation. Never silently guess on times — flag them.
3. If active_sleep_since is not null and the note indicates the baby woke up or stopped sleeping,
   output a sleep event with timestamp_start = active_sleep_since and timestamp_end = the resolved
   wake time. Set "closes_active_sleep": true on that event so the app can update the existing record
   instead of creating a new one.
4. Preserve qualitative detail in context_note verbatim-ish (e.g. "seemed in pain", "warm to the touch", "refused the bottle"). This detail is valuable; do not discard it.
5. Set confidence:"low" and populate needs_confirmation for any numeric value or time you are not sure about. A misread volume (120 -> 12) corrupts every downstream trend, so be conservative.

HARD RULES:
- You DESCRIBE and ORGANIZE the parent's data. You do NOT interpret, diagnose, advise, or flag anything as concerning or normal. No medical judgment of any kind.
- If the note asks a health/advice question ("is this rash dangerous?", "is this normal?"), do NOT answer it. Instead return it as a note of type "question_for_pediatrician" so it flows into the doctor report. Set a flag advice_requested:true so the app can show the safe redirect.
- Output ONLY valid JSON matching the schema. No prose, no markdown, no backticks.

SCHEMA:
{
  "events": [
    {
      "type": "feed | sleep | diaper | pumping | weight | temperature | medication | note | milestone | question_for_pediatrician",
      "timestamp_start": "ISO 8601",
      "timestamp_end": "ISO 8601 | null",
      "data": {
        // feed:        { method: "breast|bottle", milk_type: "breast_milk|formula|null", side: "L|R|null", volume_ml: number|null, duration_min: number|null }
        //   method "breast"  = fed directly at the breast (always breast_milk)
        //   method "bottle" + milk_type "breast_milk" = pumped/expressed breast milk from a bottle
        //   method "bottle" + milk_type "formula"     = formula from a bottle
        //   if milk type is not mentioned and method is bottle, set milk_type null and add "milk_type" to needs_confirmation
        // pumping:     { volume_ml: number|null, duration_min: number|null, side: "L|R|both|null" }
        //   Use when the parent is expressing/pumping breast milk (not a feed)
        // sleep:       { } (uses start/end)
        // diaper:      { kind: "wet|dirty|both" }  — wet = pee only, dirty = poo only, both = pee and poo
        // weight:      { value: number, unit: "kg|g|lb|oz" }
        // temperature: { value: number, unit: "C|F" }
        // medication:  { name: string, dose: string|null }
        // milestone:   { label: string }
        // note:        { }
      },
      "raw_text": "the original phrase this came from",
      "context_note": "any rich qualitative detail",
      "confidence": "high | low",
      "needs_confirmation": ["list of field names the user should verify"]
    }
  ],
  "advice_requested": false
}`

export async function extractEvents(rawText, activeSleepSince = null) {
  const apiKey = localStorage.getItem('anthropic_api_key')
  if (!apiKey) throw new Error('No API key — add it in Settings.')

  const now = new Date()
  const current_datetime = toLocalISO(now)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const userMessage = JSON.stringify({
    current_datetime,
    timezone,
    baby: BABY,
    active_sleep_since: activeSleepSince,
    note: rawText
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: localStorage.getItem('anthropic_model') || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API error ${response.status}`)
  }

  const body = await response.json()
  const text = body.content?.[0]?.text ?? ''

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Claude returned non-JSON. Raw: ' + text.slice(0, 200))
  }
}

// Build an ISO 8601 string in local time (not UTC) with the correct offset.
// toISOString() is always UTC, so we can't use it directly here.
function toLocalISO(date) {
  const off = -date.getTimezoneOffset() // minutes ahead of UTC
  const sign = off >= 0 ? '+' : '-'
  const oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const om = String(Math.abs(off) % 60).padStart(2, '0')
  const offset = `${sign}${oh}:${om}`
  const Y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const D = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${Y}-${M}-${D}T${h}:${m}:${s}${offset}`
}
