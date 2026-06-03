import { useState } from 'react'
import { toLocalISO } from '../utils/time'
import { eventToText } from '../utils/eventToText'
import EditEntry from './EditEntry'

// One-tap buttons that bypass the LLM: each creates a structured event at the
// current time, then opens the inline editor so details can be refined.
const BUTTONS = [
  { key: 'wet',     label: '💧 Wet',     type: 'diaper',  data: { kind: 'wet' },   color: 'bg-yellow-500 hover:bg-yellow-600' },
  { key: 'dirty',   label: '💩 Dirty',   type: 'diaper',  data: { kind: 'dirty' }, color: 'bg-amber-700 hover:bg-amber-800' },
  { key: 'both',    label: 'Wet+Dirty',  type: 'diaper',  data: { kind: 'both' },  color: 'bg-amber-600 hover:bg-amber-700' },
  { key: 'feed',    label: '🍼 Feed',    type: 'feed',    data: {},                color: 'bg-blue-500 hover:bg-blue-600' },
  { key: 'pumping', label: '🤱 Pumping', type: 'pumping', data: {},                color: 'bg-rose-500 hover:bg-rose-600' },
]

export default function QuickLog({ onCreate, onEdit }) {
  const [editing, setEditing] = useState(null) // the freshly-created event

  async function handleTap(btn) {
    const ev = {
      type: btn.type,
      timestamp_start: toLocalISO(new Date()),
      timestamp_end: null,
      data: { ...btn.data },
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
    }
    const saved = await onCreate(ev)
    if (saved) setEditing(saved)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {BUTTONS.map(btn => (
          <button
            key={btn.key}
            onClick={() => handleTap(btn)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold text-white shadow-sm transition ${btn.color}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {editing && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Logged: {eventToText(editing)}
            </p>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(editing.timestamp_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Add details, or just close — it's already saved.</p>
          <EditEntry
            ev={editing}
            onSave={patch => { onEdit(editing.id, patch); setEditing(null) }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
    </div>
  )
}
