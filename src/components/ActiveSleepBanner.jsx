import { useState, useEffect } from 'react'

export default function ActiveSleepBanner({ since, onMarkAwake }) {
  const [elapsed, setElapsed] = useState(getElapsed(since))

  // Update elapsed every minute
  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsed(since)), 60000)
    return () => clearInterval(id)
  }, [since])

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950 p-4 flex items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
            Baby sleeping
          </span>
        </div>
        <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">
          Since {formatTime(since)} · {elapsed}
        </p>
      </div>
      <button
        onClick={onMarkAwake}
        className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
      >
        Awake ☀
      </button>
    </div>
  )
}

function getElapsed(since) {
  const mins = Math.round((Date.now() - new Date(since).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
