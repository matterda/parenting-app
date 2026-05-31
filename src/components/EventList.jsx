import { useState } from 'react'
import { eventToText } from '../utils/eventToText'

const TYPE_COLORS = {
  feed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sleep: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  diaper: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  weight: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  temperature: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  medication: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  milestone: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  pumping: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  note: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  question_for_pediatrician: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

export default function EventList({ events, onDelete }) {
  if (events.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
        No entries yet — log something above.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map(ev => (
        <li key={ev.id} className="relative rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 pr-12 shadow-sm">
          {ev.extracted ? <ExtractedEntry ev={ev} /> : <RawEntry ev={ev} />}
          <DeleteButton onConfirm={() => onDelete(ev.id)} />
        </li>
      ))}
    </ul>
  )
}

function DeleteButton({ onConfirm }) {
  const [armed, setArmed] = useState(false)

  if (armed) {
    return (
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={onConfirm}
          className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
        >
          Delete
        </button>
        <button
          onClick={() => setArmed(false)}
          className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200"
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
      className="absolute top-2 right-2 rounded-md px-2 py-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
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
          {ev.type}
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

function RawEntry({ ev }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
          raw
        </span>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{ev.raw_text}</p>
      </div>
      <p className="mt-1.5 text-xs text-gray-300 dark:text-gray-600">
        {new Date(ev.timestamp_start).toLocaleString()}
      </p>
    </>
  )
}
