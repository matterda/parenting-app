import { useState } from 'react'
import { eventToText } from '../utils/eventToText'

// ─── constants ────────────────────────────────────────────────────────────────

const LANE_H   = 28   // px height per swim lane
const DOT      = 10   // px diameter for point events
const MIN_BAR  = 6    // px minimum bar width so tiny events are still visible

const LANE_ORDER = [
  'sleep', 'feed', 'pumping', 'diaper',
  'weight', 'temperature', 'medication', 'milestone',
  'note', 'question_for_pediatrician',
]

const LANE_LABEL = {
  feed: 'feed', sleep: 'sleep', diaper: 'diaper', pumping: 'pump',
  weight: 'weight', temperature: 'temp', medication: 'meds',
  milestone: '★', note: 'note', question_for_pediatrician: '?',
}

// Hex colours — must be inline styles since positions are dynamic
const TYPE_HEX = {
  feed:                    '#60a5fa',  // blue-400
  sleep:                   '#818cf8',  // indigo-400
  diaper:                  '#facc15',  // yellow-400
  pumping:                 '#fb7185',  // rose-400
  weight:                  '#4ade80',  // green-400
  temperature:             '#fb923c',  // orange-400
  medication:              '#f87171',  // red-400
  milestone:               '#f472b6',  // pink-400
  note:                    '#9ca3af',  // gray-400
  question_for_pediatrician: '#c084fc', // purple-400
}

// Events with a meaningful duration rendered as bars
const DURATION_TYPES = new Set(['sleep', 'pumping'])

const WINDOW_OPTIONS = [1, 3, 7]

// ─── tick generation ──────────────────────────────────────────────────────────

function generateTicks(rangeStart, rangeEnd, windowDays) {
  const stepMs      = windowDays <= 1 ? 6 * 3_600_000 : windowDays <= 3 ? 12 * 3_600_000 : 24 * 3_600_000
  const rangeDur    = rangeEnd - rangeStart
  const firstTick   = Math.ceil(rangeStart / stepMs) * stepMs
  const ticks       = []

  for (let t = firstTick; t <= rangeEnd; t += stepMs) {
    const d    = new Date(t)
    const h    = d.getHours()
    const pct  = ((t - rangeStart) / rangeDur) * 100
    const isMidnight = h === 0 && d.getMinutes() === 0

    let label
    if (windowDays <= 1) {
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (isMidnight) {
      label = d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })
    } else {
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    ticks.push({ pct, label, isMidnight })
  }
  return ticks
}

// ─── tooltip card ─────────────────────────────────────────────────────────────

function TooltipCard({ event, onClose }) {
  const color = TYPE_HEX[event.type] ?? '#9ca3af'
  const start = new Date(event.timestamp_start)
  const end   = event.timestamp_end ? new Date(event.timestamp_end) : null
  const durMin = end ? Math.round((end - start) / 60000) : null

  return (
    <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 capitalize">
            {event.type.replace(/_/g, ' ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{eventToText(event)}</p>

      {durMin != null && (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          Duration: {durMin >= 60 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : `${durMin}m`}
        </p>
      )}

      {event.context_note && (
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 italic">
          "{event.context_note}"
        </p>
      )}

      <p className="mt-1.5 text-xs text-gray-300 dark:text-gray-600">
        {start.toLocaleString()}
      </p>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function TimelineView({ events }) {
  const [windowDays, setWindowDays] = useState(3)
  const [selected, setSelected]     = useState(null)

  const now        = Date.now()
  const rangeStart = now - windowDays * 24 * 3_600_000
  const rangeDur   = now - rangeStart

  const windowEvents = events.filter(e => {
    if (!e.extracted || !e.timestamp_start) return false
    const t = new Date(e.timestamp_start).getTime()
    return t >= rangeStart && t <= now
  })

  const presentLanes = LANE_ORDER.filter(type =>
    windowEvents.some(e => e.type === type)
  )

  if (presentLanes.length === 0) return null

  function xPct(iso) {
    return Math.max(0, Math.min(100,
      ((new Date(iso).getTime() - rangeStart) / rangeDur) * 100
    ))
  }

  function barWidthPct(ev) {
    if (!ev.timestamp_end) return MIN_BAR / 6   // fallback: tiny stub
    const dur = new Date(ev.timestamp_end).getTime() - new Date(ev.timestamp_start).getTime()
    return Math.max((dur / rangeDur) * 100, 0)
  }

  const ticks = generateTicks(rangeStart, now, windowDays)
  const LABEL_W = 40 // px reserved for lane labels

  function toggle(ev) {
    setSelected(prev => (prev?.id === ev.id ? null : ev))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Timeline</h2>
        <div className="flex gap-1">
          {WINDOW_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => { setWindowDays(d); setSelected(null) }}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                windowDays === d
                  ? 'bg-violet-600 text-white'
                  : 'border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* chart */}
      <div>
        {/* swim lanes */}
        {presentLanes.map(type => {
          const laneEvents = windowEvents.filter(e => e.type === type)
          const color      = TYPE_HEX[type] ?? '#9ca3af'
          return (
            <div key={type} className="flex items-center" style={{ height: LANE_H }}>
              {/* label */}
              <div
                className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 text-right pr-1.5 select-none"
                style={{ width: LABEL_W }}
              >
                {LANE_LABEL[type] ?? type}
              </div>

              {/* lane strip */}
              <div
                className="flex-1 relative border-b border-gray-100 dark:border-gray-800"
                style={{ height: LANE_H }}
              >
                {laneEvents.map(ev => {
                  const left   = xPct(ev.timestamp_start)
                  const isBar  = DURATION_TYPES.has(type) && ev.timestamp_end
                  const isSelected = selected?.id === ev.id

                  if (isBar) {
                    const wPct = barWidthPct(ev)
                    const minW = MIN_BAR
                    return (
                      <div
                        key={ev.id}
                        onClick={() => toggle(ev)}
                        className="absolute cursor-pointer rounded transition-opacity hover:opacity-80"
                        style={{
                          left:            `${left}%`,
                          width:           `max(${wPct}%, ${minW}px)`,
                          top:             '20%',
                          height:          '60%',
                          backgroundColor: color,
                          opacity:         isSelected ? 1 : 0.85,
                          outline:         isSelected ? `2px solid ${color}` : 'none',
                          outlineOffset:   2,
                        }}
                      />
                    )
                  }

                  return (
                    <div
                      key={ev.id}
                      onClick={() => toggle(ev)}
                      className="absolute cursor-pointer rounded-full transition-opacity hover:opacity-80"
                      style={{
                        left:            `${left}%`,
                        top:             '50%',
                        transform:       'translate(-50%, -50%)',
                        width:           DOT,
                        height:          DOT,
                        backgroundColor: color,
                        opacity:         isSelected ? 1 : 0.85,
                        outline:         isSelected ? `2px solid ${color}` : 'none',
                        outlineOffset:   2,
                        border:          '1.5px solid white',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* x-axis ticks */}
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          <div className="flex-1 relative" style={{ height: 24 }}>
            {ticks.map(tick => (
              <div
                key={tick.pct}
                className="absolute flex flex-col items-center"
                style={{ left: `${tick.pct}%`, transform: 'translateX(-50%)' }}
              >
                <div className={`w-px ${tick.isMidnight ? 'h-2 bg-gray-300 dark:bg-gray-600' : 'h-1.5 bg-gray-200 dark:bg-gray-700'}`} />
                <span className={`text-[9px] whitespace-nowrap mt-0.5 ${
                  tick.isMidnight
                    ? 'text-gray-500 dark:text-gray-400 font-medium'
                    : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {tick.label}
                </span>
              </div>
            ))}
            {/* "now" marker */}
            <div
              className="absolute top-0 flex flex-col items-center"
              style={{ left: '100%', transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-2 bg-violet-400" />
              <span className="text-[9px] text-violet-400 font-medium mt-0.5">now</span>
            </div>
          </div>
        </div>
      </div>

      {/* tooltip */}
      {selected && <TooltipCard event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
