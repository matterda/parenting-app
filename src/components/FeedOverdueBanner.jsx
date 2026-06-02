import { useState, useEffect } from 'react'
import { getFeedOverdueStatus } from '../notifications'

// Shown in the Log tab when a feed reminder is enabled and overdue.
// Ticks every minute. Works on all platforms regardless of OS notification support.
export default function FeedOverdueBanner({ events }) {
  const [status, setStatus] = useState(() => getFeedOverdueStatus(events))

  useEffect(() => {
    setStatus(getFeedOverdueStatus(events))
  }, [events])

  useEffect(() => {
    const id = setInterval(() => setStatus(getFeedOverdueStatus(events)), 60000)
    return () => clearInterval(id)
  }, [events])

  if (!status.overdue) return null

  const h = Math.floor(status.sinceMin / 60)
  const m = status.sinceMin % 60
  const elapsed = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-3 flex items-center gap-3">
      <span className="text-xl shrink-0">🍼</span>
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Feed reminder — {elapsed} since last {status.label ?? 'feed'}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {new Date(status.lastFeed.timestamp_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
