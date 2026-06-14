import { useState } from 'react'
import { eventToText } from '../utils/eventToText'
import EditEntry from './EditEntry'
import DayTimeline from './DayTimeline'

const TYPE_COLORS = {
  feed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sleep: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  diaper: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  weight: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  weighin: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  reminder: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  devcheck: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  temperature: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  medication: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  milestone: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  pumping: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  note: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  question_for_pediatrician: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

const TYPE_LABELS = {
  feed: 'feed', sleep: 'sleep', diaper: 'diaper', weight: 'weight',
  temperature: 'temp', medication: 'meds', milestone: 'milestone',
  pumping: 'pumping', note: 'note', question_for_pediatrician: 'question',
  weighin: 'weigh-in', reminder: 'reminder', devcheck: 'dev check',
}

export default function EventList({ events, onDelete, onEdit, onCreate, onRetryRaw }) {
  // Set of selected type filters; empty = show all. A non-extracted event
  // matches the 'raw' filter.
  const [selected, setSelected] = useState(() => new Set())
  const [view, setView] = useState('list') // 'list' | 'timeline'

  const viewToggle = (
    <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 self-end">
      {['list', 'timeline'].map(v => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            view === v ? 'bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {v === 'list' ? 'List' : 'Timeline'}
        </button>
      ))}
    </div>
  )

  if (view === 'timeline') {
    return (
      <div className="flex flex-col gap-3">
        {viewToggle}
        <DayTimeline events={events} onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {viewToggle}
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
          No entries yet — log something above.
        </p>
      </div>
    )
  }

  // Derive the set of types that actually appear in the list
  const presentTypes = [...new Set(events.map(e => e.type ?? 'raw').filter(Boolean))]

  const matches = e => selected.has(e.extracted ? e.type : 'raw')
  const visible = selected.size === 0 ? events : events.filter(matches)

  function toggle(t) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {viewToggle}
      {/* Filter chips — multi-select; "All" clears the selection */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="All" active={selected.size === 0} onClick={() => setSelected(new Set())} />
        {presentTypes.map(t => (
          <FilterChip
            key={t}
            label={TYPE_LABELS[t] ?? t}
            active={selected.has(t)}
            onClick={() => toggle(t)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No entries of this type.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groupByDay(visible).map(g => (
            <div key={g.key} className="flex gap-2">
              <ul className="flex-1 flex flex-col gap-3 min-w-0">
                {g.items.map(ev => (
                  <EventItem key={ev.id} ev={ev} onDelete={onDelete} onEdit={onEdit} onRetryRaw={onRetryRaw} />
                ))}
              </ul>
              {/* Day indicator: vertical bar + short date label */}
              <div className="shrink-0 w-9 relative">
                <div className="absolute top-6 bottom-0 left-1/2 -translate-x-1/2 w-px bg-violet-200 dark:bg-violet-800" />
                <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded bg-violet-100 dark:bg-violet-900 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 whitespace-nowrap">
                  {g.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Group events into consecutive same-day buckets, newest day first, each day's
// events newest-first. Returns [{ key, label: "6/6", items: [...] }].
function groupByDay(events) {
  const sorted = [...events].sort((a, b) => (a.timestamp_start < b.timestamp_start ? 1 : -1))
  const groups = []
  for (const ev of sorted) {
    const d = new Date(ev.timestamp_start)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(ev)
    else groups.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, items: [ev] })
  }
  return groups
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-violet-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  )
}

function EventItem({ ev, onDelete, onEdit, onRetryRaw }) {
  const [editing, setEditing] = useState(false)

  function handleSave(patch) {
    onEdit(ev.id, patch)
    setEditing(false)
  }

  return (
    <li className={`relative rounded-xl border p-4 shadow-sm ${
      ev.extracted
        ? 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
        : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'
    }`}>
      <div className="pr-16">
        {ev.extracted ? <ExtractedEntry ev={ev} /> : <RawEntry ev={ev} onRetry={onRetryRaw ? () => onRetryRaw(ev) : null} />}
      </div>

      {!editing && (
        <div className="absolute top-2 right-2 flex gap-1">
          <EditButton onEdit={() => setEditing(true)} />
          <DeleteButton onConfirm={() => onDelete(ev.id)} />
        </div>
      )}

      {editing && (
        <EditEntry ev={ev} onSave={handleSave} onCancel={() => setEditing(false)} />
      )}
    </li>
  )
}

function EditButton({ onEdit }) {
  return (
    <button
      onClick={onEdit}
      aria-label="Edit entry"
      className="rounded-md px-2 py-1 text-gray-300 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition"
    >
      ✎
    </button>
  )
}

function DeleteButton({ onConfirm }) {
  const [armed, setArmed] = useState(false)

  if (armed) {
    return (
      <div className="flex gap-1">
        <button
          onClick={onConfirm}
          className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
        >
          Delete
        </button>
        <button
          onClick={() => setArmed(false)}
          className="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setArmed(true)}
      aria-label="Delete entry"
      className="rounded-md px-2 py-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
    >
      ✕
    </button>
  )
}

function ExtractedEntry({ ev }) {
  const colorClass = TYPE_COLORS[ev.type] ?? 'bg-gray-100 text-gray-600'
  return (
    <>
      <div className="flex items-start gap-2">
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
          {TYPE_LABELS[ev.type] ?? ev.type}
        </span>
        <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{eventToText(ev)}</p>
      </div>
      {ev.context_note && (
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 italic pl-1">"{ev.context_note}"</p>
      )}
      <p className="mt-1.5 text-xs text-gray-300 dark:text-gray-600">
        {new Date(ev.timestamp_start).toLocaleString()}
      </p>
    </>
  )
}

function RawEntry({ ev, onRetry }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          raw
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{ev.raw_text}</p>
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        Not extracted — won't appear in trends. Retry extraction or edit it by hand.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition"
        >
          Retry extraction
        </button>
      )}
      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-600">
        {new Date(ev.timestamp_start).toLocaleString()}
      </p>
    </>
  )
}
