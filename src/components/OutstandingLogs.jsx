import { useState } from 'react'
import { incompleteEvents } from '../utils/aggregate'
import { eventToText } from '../utils/eventToText'
import EditEntry from './EditEntry'

// Shown in the Log tab: recent (last 24h) events missing details, with a
// one-tap inline editor to fill them in. Hidden entirely when nothing's pending.
export default function OutstandingLogs({ events, onEdit }) {
  const [editingId, setEditingId] = useState(null)
  const items = incompleteEvents(events)

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Needs details ({items.length})
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Recent logs missing info — tap one to fill it in.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map(({ event, reasons }) => {
          const open = editingId === event.id
          return (
            <li key={event.id} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 px-3 py-2.5">
              <button
                onClick={() => setEditingId(open ? null : event.id)}
                className="w-full text-left"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-gray-800 dark:text-gray-100">{eventToText(event)}</span>
                  <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(event.timestamp_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400">missing: {reasons.join(', ')}</span>
              </button>

              {open && (
                <EditEntry
                  ev={event}
                  onSave={patch => { onEdit(event.id, patch); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
