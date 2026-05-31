import { useState } from 'react'
import { eventToText, FIELD_LABELS } from '../utils/eventToText'

export default function EchoLoop({ events, adviceRequested, onConfirm, onReject }) {
  const [edits, setEdits] = useState(() =>
    events.map(ev => ({ ...ev, data: { ...(ev.data ?? {}) } }))
  )

  function updateField(evIndex, field, value) {
    setEdits(prev => {
      const next = prev.map((ev, i) => i === evIndex ? { ...ev, data: { ...ev.data } } : ev)
      // timestamp fields live on the event root, data fields live in ev.data
      if (field === 'timestamp_start' || field === 'timestamp_end') {
        next[evIndex] = { ...next[evIndex], [field]: toISO(next[evIndex][field], value) }
      } else {
        next[evIndex].data[field] = value
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Here's what I logged — tap any amber field to correct it.
      </p>

      {events.map((ev, i) => (
        <EventCard
          key={i}
          event={edits[i]}
          onFieldChange={(field, val) => updateField(i, field, val)}
        />
      ))}

      {adviceRequested && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>Note:</strong> I can't assess health questions — but I've saved it for
          your pediatrician. You'll find it in the report.
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => onConfirm(edits)}
          className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition"
        >
          Looks right ✓
        </button>
        <button
          onClick={onReject}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Fix note
        </button>
      </div>
    </div>
  )
}

function EventCard({ event, onFieldChange }) {
  const needsConfirm = new Set(event.needs_confirmation ?? [])
  const d = event.data ?? {}

  const confirmableFields = getConfirmableFields(event)

  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm ${
      event.confidence === 'low' ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-gray-800'
    }`}>
      <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{eventToText(event)}</p>

      {event.context_note && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">"{event.context_note}"</p>
      )}

      {confirmableFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {confirmableFields.map(({ field, label, currentValue }) => (
            <FieldChip
              key={field}
              field={field}
              label={label}
              value={currentValue}
              needsConfirm={needsConfirm.has(field)}
              onChange={val => onFieldChange(field, val)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FieldChip({ field, label, value, needsConfirm, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayValue(field, value))

  function commit() {
    onChange(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className="rounded-lg border border-violet-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-violet-400"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
        needsConfirm
          ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/60'
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
      }`}
    >
      {label}: {displayValue(field, value)}
    </button>
  )
}

// Which fields to surface as chips on each event type
function getConfirmableFields(event) {
  const d = event.data ?? {}
  const needs = new Set(event.needs_confirmation ?? [])
  const candidates = []

  const add = (field, label, value) => {
    // Always show needs_confirmation fields; only show others if they have values
    if (needs.has(field) || value != null) {
      candidates.push({ field, label, currentValue: value })
    }
  }

  if (event.type === 'feed') {
    add('milk_type', 'milk type', d.milk_type)
    add('volume_ml', 'ml', d.volume_ml)
    add('duration_min', 'min', d.duration_min)
    add('side', 'side', d.side)
  }
  if (event.type === 'pumping') {
    add('volume_ml', 'ml', d.volume_ml)
    add('duration_min', 'min', d.duration_min)
    add('side', 'side', d.side)
  }
  if (event.type === 'sleep') {
    add('timestamp_end', 'end time', event.timestamp_end)
  }
  if (event.type === 'diaper') {
    add('kind', 'type', d.kind)
  }
  if (event.type === 'weight') {
    add('value', 'value', d.value)
  }
  if (event.type === 'temperature') {
    add('value', 'value', d.value)
  }
  if (event.type === 'medication') {
    add('dose', 'dose', d.dose)
  }

  // Always show start time if it needs confirmation
  if (needs.has('timestamp_start')) {
    candidates.unshift({ field: 'timestamp_start', label: 'time', currentValue: event.timestamp_start })
  }

  return candidates
}

function displayValue(field, value) {
  if (value == null) return '?'
  if (field === 'timestamp_start' || field === 'timestamp_end') {
    try {
      return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return value }
  }
  return String(value)
}

// When the user types a time like "3:05" into a timestamp chip, reconstruct a full ISO string
function toISO(existingISO, newTimeStr) {
  try {
    const base = existingISO ? new Date(existingISO) : new Date()
    const [h, m] = newTimeStr.split(':').map(Number)
    if (isNaN(h)) return existingISO
    base.setHours(h, m ?? 0, 0, 0)
    return base.toISOString()
  } catch {
    return existingISO
  }
}
