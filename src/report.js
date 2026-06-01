import { buildReportData } from './utils/reportData'

const SYSTEM_PROMPT = `You generate a one-page clinical summary for a pediatrician appointment.

YOUR JOB:
Summarize the parent's logged baby data into a clean, printable HTML report.
A busy clinician should be able to read it in under 60 seconds.

HARD RULES:
- State facts and observed changes only. Do NOT interpret, diagnose, or label anything as
  normal, abnormal, or concerning. The clinician interprets — not you.
- "What changed" section: compare current window to prior window using plain descriptive
  language only. Example: "Feeds decreased from ~6/day to ~4/day." Never editorialize.
- "Notable context" section: cluster and quote the parent's qualitative notes verbatim.
  Do not paraphrase or assess them.
- If there are no questions, omit the Questions section entirely.
- If a section has no data, omit it entirely rather than writing "no data".
- Output a clean HTML fragment (no <html>/<head>/<body> tags). Use only inline styles.
  No external CSS, no JavaScript, no images.

OUTPUT FORMAT (follow this structure exactly):
<div style="font-family: Georgia, serif; max-width: 680px; margin: 0 auto; color: #111; line-height: 1.5;">
  <h1>...</h1>          <!-- Baby name + period -->
  <p>...</p>            <!-- one-line header: age, date range -->
  <h2>Summary</h2>      <!-- feeds, sleep, diapers as plain averages/totals -->
  <h2>What changed</h2> <!-- deltas vs prior period, descriptive only -->
  <h2>Notable context</h2> <!-- clustered qualitative notes -->
  <h2>Questions for the pediatrician</h2> <!-- verbatim parent questions, if any -->
</div>`

function getBaby() {
  return {
    name: localStorage.getItem('baby_name') || 'Baby',
    date_of_birth: localStorage.getItem('baby_dob') || null,
  }
}

export async function generateReport(events, windowDays) {
  const apiKey = localStorage.getItem('anthropic_api_key')
  if (!apiKey) throw new Error('No API key — add it in Settings.')

  const baby = getBaby()
  const data = buildReportData(events, windowDays)

  // Compute age string if DOB known
  let ageStr = ''
  if (baby.date_of_birth) {
    const dob  = new Date(baby.date_of_birth)
    const now  = new Date()
    const days = Math.round((now - dob) / 86_400_000)
    if (days < 30)       ageStr = `${days} days old`
    else if (days < 365) ageStr = `${Math.floor(days / 7)} weeks old`
    else {
      const months = Math.floor(days / 30.44)
      ageStr = months < 24 ? `${months} months old` : `${Math.floor(months / 12)} years old`
    }
  }

  const userMessage = JSON.stringify({
    baby: { ...baby, age: ageStr },
    current_window: data.current,
    prior_window:   data.prior,
  }, null, 2)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: localStorage.getItem('anthropic_model') || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API error ${response.status}`)
  }

  const body = await response.json()
  const html = (body.content?.[0]?.text ?? '')
    .replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  return html
}
