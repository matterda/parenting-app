import { useState } from 'react'
import { generateReport } from '../report'

const WINDOWS = [
  { days: 7,  label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
]

export default function ReportView({ events }) {
  const [windowDays, setWindowDays] = useState(14)
  const [phase, setPhase] = useState('idle') // idle | generating | done | error
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  async function handleGenerate() {
    setPhase('generating')
    setHtml('')
    setError('')
    try {
      const result = await generateReport(events, windowDays)
      setHtml(result)
      setPhase('done')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  function handlePrint() {
    const baby = localStorage.getItem('baby_name') || 'Baby'
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${baby} — Pediatrician report</title>
  <style>
    body { margin: 32px; }
    @media print {
      body { margin: 16px; }
    }
  </style>
</head>
<body>
  ${html}
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`)
    win.document.close()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Generates a one-page summary for your next pediatrician visit — feeds, sleep, diapers, qualitative notes, and your saved questions.
        </p>

        {/* Window selector */}
        <div className="flex gap-2">
          {WINDOWS.map(w => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                windowDays === w.days
                  ? 'bg-violet-600 text-white'
                  : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={phase === 'generating'}
          className="self-start rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {phase === 'generating' && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {phase === 'generating' ? 'Generating…' : 'Generate report'}
        </button>
      </div>

      {phase === 'error' && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {phase === 'done' && html && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500">Preview — tap Print to save as PDF</p>
            <button
              onClick={handlePrint}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              🖨 Print / Save PDF
            </button>
          </div>

          {/* Report preview */}
          <div
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm prose prose-sm max-w-none
              [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:dark:text-gray-100 [&_h1]:mb-1
              [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-violet-700 [&_h2]:dark:text-violet-400 [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-4 [&_h2]:mb-1.5
              [&_p]:text-sm [&_p]:text-gray-700 [&_p]:dark:text-gray-300 [&_p]:leading-relaxed
              [&_ul]:text-sm [&_ul]:text-gray-700 [&_ul]:dark:text-gray-300 [&_ul]:pl-4
              [&_li]:mb-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  )
}
