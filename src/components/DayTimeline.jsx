import { useState, useRef, useEffect } from 'react'
import { eventToText } from '../utils/eventToText'
import { toLocalISO } from '../utils/time'
import EditEntry from './EditEntry'

const PX_PER_HOUR = 64
const DAY_PX = PX_PER_HOUR * 24

// Block colors per type (left bar + chip)
const TYPE_HEX = {
  feed: '#3b82f6',
  sleep: '#6366f1',
  diaper: '#eab308',
  pumping: '#f43f5e',
  weight: '#22c55e',
  temperature: '#f97316',
  medication: '#ef4444',
  milestone: '#ec4899',
  note: '#9ca3af',
  question_for_pediatrician: '#a855f7',
}

// Types offered in the tap-to-create picker (most common first)
const CREATABLE = ['feed', 'sleep', 'diaper', 'pumping', 'weight', 'temperature', 'medication', 'note']

function sameLocalDay(iso, ref) {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
}

function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

// minutes since local midnight for an ISO timestamp, clamped to [0, 1440]
function minutesInto(iso, dayStart) {
  const ms = new Date(iso).getTime() - dayStart.getTime()
  return Math.max(0, Math.min(1440, ms / 60000))
}

export default function DayTimeline({ events, onCreate, onEdit, onDelete }) {
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [editingId, setEditingId] = useState(null)
  const [picker, setPicker] = useState(null) // { minutes }
  const trackRef = useRef(null)

  const dayStart = startOfDay(day)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const isToday = sameLocalDay(new Date().toISOString(), dayStart)

  // Events overlapping this local day (sleeps with an end count if they span it)
  const dayEvents = events.filter(e => {
    if (!e.extracted || !e.timestamp_start) return false
    const s = new Date(e.timestamp_start).getTime()
    if (e.timestamp_end) {
      const en = new Date(e.timestamp_end).getTime()
      return en > dayStart.getTime() && s < dayEnd.getTime()
    }
    return sameLocalDay(e.timestamp_start, dayStart)
  })

  // Scroll to a sensible spot (08:00) on mount / day change
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.parentElement.scrollTop = isToday
        ? Math.max(0, minutesInto(new Date().toISOString(), dayStart) / 60 * PX_PER_HOUR - 200)
        : 7 * PX_PER_HOUR
    }
  }, [day]) // eslint-disable-line react-hooks/exhaustive-deps

  function shiftDay(delta) {
    setEditingId(null); setPicker(null)
    setDay(prev => { const x = new Date(prev); x.setDate(x.getDate() + delta); return startOfDay(x) })
  }

  function handleTrackClick(e) {
    if (editingId) { setEditingId(null); return }
    const rect = trackRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    let mins = Math.round((y / PX_PER_HOUR * 60) / 5) * 5
    mins = Math.max(0, Math.min(1435, mins))
    setPicker({ minutes: mins })
  }

  async function createAt(type) {
    const start = new Date(dayStart.getTime() + picker.minutes * 60000)
    const ev = {
      type,
      timestamp_start: toLocalISO(start),
      timestamp_end: type === 'sleep' ? toLocalISO(new Date(start.getTime() + 3_600_000)) : null,
      data: {},
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
    }
    const saved = await onCreate(ev)
    setPicker(null)
    if (saved?.id) setEditingId(saved.id)
  }

  const pickerTop = picker ? picker.minutes / 60 * PX_PER_HOUR : 0
  const editingEvent = editingId ? dayEvents.find(e => e.id === editingId) : null

  return (
    <div className="flex flex-col gap-3">
      {/* Day navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDay(-1)} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">←</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {dayStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          {!isToday && (
            <button onClick={() => setDay(startOfDay(new Date()))} className="text-xs text-violet-600 dark:text-violet-400">Jump to today</button>
          )}
        </div>
        <button onClick={() => shiftDay(1)} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">→</button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Tap any time to add an event · tap an event to edit</p>

      {/* Scrollable timeline */}
      <div className="relative overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ maxHeight: '60vh' }}>
        <div ref={trackRef} className="relative" style={{ height: DAY_PX }} onClick={handleTrackClick}>
          {/* Hour grid + labels */}
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800" style={{ top: h * PX_PER_HOUR }}>
              <span className="absolute -top-2 left-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 px-0.5">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {/* Now marker */}
          {isToday && (
            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: minutesInto(new Date().toISOString(), dayStart) / 60 * PX_PER_HOUR }}>
              <div className="h-px bg-red-500" />
              <div className="absolute -top-1 left-0 h-2 w-2 rounded-full bg-red-500" />
            </div>
          )}

          {/* Events */}
          {dayEvents.map(ev => {
            const top = minutesInto(ev.timestamp_start, dayStart) / 60 * PX_PER_HOUR
            const hasEnd = !!ev.timestamp_end
            const endMin = hasEnd ? minutesInto(ev.timestamp_end, dayStart) : minutesInto(ev.timestamp_start, dayStart)
            const height = hasEnd ? Math.max(20, (endMin - minutesInto(ev.timestamp_start, dayStart)) / 60 * PX_PER_HOUR) : 0
            const hex = TYPE_HEX[ev.type] ?? '#9ca3af'
            return (
              <button
                key={ev.id}
                onClick={e => { e.stopPropagation(); setPicker(null); setEditingId(ev.id === editingId ? null : ev.id) }}
                className="absolute left-14 right-2 z-20 text-left rounded-md px-2 py-1 shadow-sm border"
                style={{
                  top,
                  height: hasEnd ? height : undefined,
                  backgroundColor: hex + '22',
                  borderColor: hex + '66',
                  borderLeft: `3px solid ${hex}`,
                }}
              >
                <span className="block text-[11px] leading-tight font-medium text-gray-800 dark:text-gray-100 truncate">
                  {eventToText(ev)}
                </span>
                <span className="block text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                  {new Date(ev.timestamp_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {hasEnd && ' – ' + new Date(ev.timestamp_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            )
          })}

          {/* Tap-to-create ghost line + picker */}
          {picker && (
            <div className="absolute left-0 right-0 z-30" style={{ top: pickerTop }} onClick={e => e.stopPropagation()}>
              <div className="h-px bg-violet-500" />
              <div className="ml-14 mr-2 mt-1 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 p-2 shadow-lg">
                <p className="mb-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Add at {new Date(dayStart.getTime() + picker.minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CREATABLE.map(t => (
                    <button
                      key={t}
                      onClick={() => createAt(t)}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-white"
                      style={{ backgroundColor: TYPE_HEX[t] ?? '#9ca3af' }}
                    >
                      {t}
                    </button>
                  ))}
                  <button onClick={() => setPicker(null)} className="rounded-md px-2 py-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline editor for the selected event */}
      {editingEvent && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{eventToText(editingEvent)}</p>
            <button
              onClick={() => { onDelete(editingEvent.id); setEditingId(null) }}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete
            </button>
          </div>
          <EditEntry
            ev={editingEvent}
            onSave={patch => { onEdit(editingEvent.id, patch); setEditingId(null) }}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  )
}
