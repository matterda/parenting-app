import { useState } from 'react'
import { eventToText } from '../utils/eventToText'
import { toLocalISO } from '../utils/time'
import EditEntry from './EditEntry'

const DAYS = 7
const PX_PER_HOUR = 34
const DAY_PX = PX_PER_HOUR * 24
const HEADER_PX = 30
const GUTTER_PX = 32

const TYPE_HEX = {
  feed: '#3b82f6',
  sleep: '#6366f1',
  diaper: '#eab308',
  pumping: '#f43f5e',
  weight: '#22c55e',
  weighin: '#14b8a6',
  temperature: '#f97316',
  medication: '#ef4444',
  milestone: '#ec4899',
  reminder: '#0ea5e9',
  note: '#9ca3af',
  question_for_pediatrician: '#a855f7',
}

const CREATABLE = ['feed', 'sleep', 'diaper', 'pumping', 'weight', 'temperature', 'medication', 'note']

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return startOfDay(x) }
function dayKey(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
function sameDay(a, b) { return dayKey(new Date(a)) === dayKey(b) }

// Minutes since the given day's midnight, clamped to [0, 1440].
function minsInto(iso, dayStartMs) {
  return Math.max(0, Math.min(1440, (new Date(iso).getTime() - dayStartMs) / 60000))
}

export default function DayTimeline({ events, onCreate, onEdit, onDelete }) {
  const [endDay, setEndDay] = useState(() => startOfDay(new Date()))
  const [editingId, setEditingId] = useState(null)
  const [picker, setPicker] = useState(null) // { dayStartMs, dayLabel, minutes }

  const today = startOfDay(new Date())
  const canGoNext = endDay.getTime() < today.getTime()

  // Columns oldest → newest (today rightmost when at the latest window).
  const days = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = addDays(endDay, -i)
    days.push({
      key: dayKey(d),
      start: d.getTime(),
      end: d.getTime() + 86_400_000,
      weekday: d.toLocaleDateString([], { weekday: 'short' }),
      short: `${d.getDate()}/${d.getMonth() + 1}`,
      isToday: sameDay(d, today),
    })
  }

  function shift(deltaDays) {
    setEditingId(null); setPicker(null)
    setEndDay(prev => addDays(prev, deltaDays))
  }

  function handleColumnClick(e, day) {
    if (editingId) { setEditingId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    let mins = Math.round((y / PX_PER_HOUR * 60) / 5) * 5
    mins = Math.max(0, Math.min(1435, mins))
    setPicker({ dayStartMs: day.start, dayLabel: `${day.weekday} ${day.short}`, minutes: mins })
  }

  async function createAt(type) {
    const start = new Date(picker.dayStartMs + picker.minutes * 60000)
    const saved = await onCreate({
      type,
      timestamp_start: toLocalISO(start),
      timestamp_end: type === 'sleep' ? toLocalISO(new Date(start.getTime() + 3_600_000)) : null,
      data: {},
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
    })
    setPicker(null)
    if (saved?.id) setEditingId(saved.id)
  }

  const fmtMins = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const editingEvent = editingId ? events.find(e => e.id === editingId) : null
  const nowMins = (Date.now() - today.getTime()) / 60000

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-DAYS)} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">←</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{days[0].short} – {days[DAYS - 1].short}</p>
          {canGoNext && <button onClick={() => setEndDay(today)} className="text-xs text-violet-600 dark:text-violet-400">Jump to today</button>}
        </div>
        <button onClick={() => canGoNext && shift(DAYS)} disabled={!canGoNext} className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30">→</button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Tap a time in any day to add · tap an event to edit</p>

      {/* Tap-to-create picker */}
      {picker && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 p-3">
          <p className="mb-1.5 text-xs text-gray-600 dark:text-gray-300">Add at {picker.dayLabel} {fmtMins(picker.minutes)}</p>
          <div className="flex flex-wrap gap-1.5">
            {CREATABLE.map(t => (
              <button key={t} onClick={() => createAt(t)} className="rounded-md px-2 py-1 text-[11px] font-medium text-white" style={{ backgroundColor: TYPE_HEX[t] ?? '#9ca3af' }}>{t}</button>
            ))}
            <button onClick={() => setPicker(null)} className="rounded-md px-2 py-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">cancel</button>
          </div>
        </div>
      )}

      {/* Inline editor */}
      {editingEvent && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{eventToText(editingEvent)}</p>
            <button onClick={() => { onDelete(editingEvent.id); setEditingId(null) }} className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
          </div>
          <EditEntry ev={editingEvent} onSave={patch => { onEdit(editingEvent.id, patch); setEditingId(null) }} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ maxHeight: '65vh' }}>
        <div className="flex">
          {/* Hour gutter */}
          <div className="shrink-0" style={{ width: GUTTER_PX }}>
            <div style={{ height: HEADER_PX }} />
            <div className="relative" style={{ height: DAY_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="absolute right-1 text-[9px] tabular-nums text-gray-400 dark:text-gray-500 -translate-y-1/2" style={{ top: h * PX_PER_HOUR }}>
                  {String(h).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {days.map(day => {
            const dayEvents = events.filter(e => {
              if (!e.extracted || !e.timestamp_start) return false
              const s = new Date(e.timestamp_start).getTime()
              if (e.timestamp_end) return new Date(e.timestamp_end).getTime() > day.start && s < day.end
              return s >= day.start && s < day.end
            })
            return (
              <div key={day.key} className="flex-1 border-l border-gray-100 dark:border-gray-800" style={{ minWidth: 42 }}>
                <div className={`sticky top-0 z-20 flex flex-col items-center justify-center border-b border-gray-100 dark:border-gray-800 ${day.isToday ? 'bg-violet-50 dark:bg-violet-950' : 'bg-white dark:bg-gray-900'}`} style={{ height: HEADER_PX }}>
                  <span className={`text-[10px] font-semibold leading-none ${day.isToday ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-300'}`}>{day.weekday}</span>
                  <span className="text-[9px] leading-none text-gray-400 dark:text-gray-500">{day.short}</span>
                </div>
                <div className="relative" style={{ height: DAY_PX }} onClick={e => handleColumnClick(e, day)}>
                  {/* hour gridlines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="absolute left-0 right-0 border-t border-gray-50 dark:border-gray-800/60" style={{ top: h * PX_PER_HOUR }} />
                  ))}
                  {/* now marker */}
                  {day.isToday && nowMins >= 0 && nowMins <= 1440 && (
                    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowMins / 60 * PX_PER_HOUR }}>
                      <div className="h-px bg-red-500" />
                    </div>
                  )}
                  {/* events */}
                  {dayEvents.map(ev => {
                    const top = minsInto(ev.timestamp_start, day.start) / 60 * PX_PER_HOUR
                    const hasEnd = !!ev.timestamp_end
                    const height = hasEnd
                      ? Math.max(8, (minsInto(ev.timestamp_end, day.start) - minsInto(ev.timestamp_start, day.start)) / 60 * PX_PER_HOUR)
                      : 11
                    const hex = TYPE_HEX[ev.type] ?? '#9ca3af'
                    return (
                      <button
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); setPicker(null); setEditingId(ev.id === editingId ? null : ev.id) }}
                        className="absolute left-0.5 right-0.5 z-20 rounded-sm"
                        style={{ top, height, backgroundColor: hex + (hasEnd ? '33' : 'cc'), borderLeft: `2px solid ${hex}` }}
                        title={eventToText(ev)}
                      />
                    )
                  })}
                  {/* ghost line for the pending create */}
                  {picker && picker.dayStartMs === day.start && (
                    <div className="absolute left-0 right-0 z-30 h-px bg-violet-500 pointer-events-none" style={{ top: picker.minutes / 60 * PX_PER_HOUR }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
