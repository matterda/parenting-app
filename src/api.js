const BABY = {
  name: 'baby name',
  date_of_birth: '2025-01-01' // placeholder — update with real DOB
}

const SYSTEM_PROMPT = `You convert a parent's free-text or dictated note about their baby into structured log events.

CONTEXT YOU RECEIVE:
- current_datetime (ISO, with timezone)
- baby: { name, date_of_birth }
- the parent's raw note

YOUR JOB:
1. Extract every loggable event into the schema below. One note may contain several.
2. Resolve relative and vague times against current_datetime ("an hour ago", "at 3", "last night", "this morning"). When a time is genuinely ambiguous (am vs pm, today vs yesterday, a bare number), pick the most likely reading AND add the field to needs_confirmation. Never silently guess on times — flag them.
3. Preserve qualitative detail in context_note verbatim-ish (e.g. "seemed in pain", "warm to the touch", "refused the bottle"). This detail is valuable; do not discard it.
4. Set confidence:"low" and populate needs_confirmation for any numeric value or time you are not sure about. A misread volume (120 -> 12) corrupts every downstream trend, so be conservative.

HARD RULES:
- You DESCRIBE and ORGANIZE the parent's data. You do NOT interpret, diagnose, advise, or flag anything as concerning or normal. No medical judgment of any kind.
- If the note asks a health/advice question ("is this rash dangerous?", "is this normal?"), do NOT answer it. Instead return it as a note of type "question_for_pediatrician" so it flows into the doctor report. Set a flag advice_requested:true so the app can show the safe redirect.
- Output ONLY valid JSON matching the schema. No prose, no markdown, no backticks.

SCHEMA:
{
  "events": [
    {
      "type": "feed | sleep | diaper | weight | temperature | medication | note | milestone | question_for_pediatrician",
      "timestamp_start": "ISO 8601",
      "timestamp_end": "ISO 8601 | null",
      "data": {},
      "raw_text": "the original phrase this came from",
      "context_note": "any rich qualitative detail",
      "confidence": "high | low",
      "needs_confirmation": ["list of field names the user should verify"]
    }
  ],
  "advice_requested": false
}`

export async function extractEvents(rawText) {
  const apiKey = localStorage.getItem('anthropic_api_key')
  if (!apiKey) throw new Error('No API key — add it in Settings.')

  const now = new Date()
  const current_datetime = now.toISOString().replace('Z', getTimezoneOffset(now))

  const userMessage = JSON.stringify({
    current_datetime,
    baby: BABY,
    note: rawText
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser-access': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
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

function getTimezoneOffset(date) {
  const off = -date.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const m = String(Math.abs(off) % 60).padStart(2, '0')
  return `${sign}${h}:${m}`
}
