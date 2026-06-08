import { useState } from 'react'
import { toLocalISO } from '../utils/time'
import { relativeTime } from '../utils/aggregate'

// Lightweight to-do list in the Log tab. A reminder is an event with
// timestamp_start = creation and timestamp_end = done time; it stays "to do"
// (shown here) until marked done, after which it drops into History.
export default function Reminders({ events, onCreate, onEdit, onDelete }) {
  const [text, setText] = useState('')

  const open = events
    .filter(e => e.extracted && e.type === 'reminder' && !e.timestamp_end)
    .sort((a, b) => (a.timestamp_start < b.timestamp_start ? -1 : 1)) // oldest first

  async function add() {
    const t = text.trim()
    if (!t) return
    setText('')
    await onCreate({
      type: 'reminder',
      timestamp_start: toLocalISO(new Date()),
      timestamp_end: null,
      data: { text: t },
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
    })
  }

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
        Reminders{open.length > 0 ? ` (${open.length})` : ''}
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="Add a reminder…"
          className="flex-1 min-w-0 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40 transition"
        >
          Add
        </button>
      </div>

      {open.length > 0 && (
        <ul className="flex flex-col gap-2">
          {open.map(r => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-900 px-3 py-2.5">
              <button
                onClick={() => onEdit(r.id, { timestamp_end: toLocalISO(new Date()) })}
                aria-label="Mark done"
                className="shrink-0 h-5 w-5 rounded-md border-2 border-sky-400 dark:border-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900 transition"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-100 break-words">{r.data?.text}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">added {relativeTime(r.timestamp_start)}</p>
              </div>
              <button
                onClick={() => onDelete(r.id)}
                aria-label="Delete reminder"
                className="shrink-0 rounded-md px-1.5 py-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
