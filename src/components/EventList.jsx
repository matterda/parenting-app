import { eventToText } from '../utils/eventToText'

const TYPE_COLORS = {
  feed: 'bg-blue-100 text-blue-700',
  sleep: 'bg-indigo-100 text-indigo-700',
  diaper: 'bg-yellow-100 text-yellow-700',
  weight: 'bg-green-100 text-green-700',
  temperature: 'bg-orange-100 text-orange-700',
  medication: 'bg-red-100 text-red-700',
  milestone: 'bg-pink-100 text-pink-700',
  note: 'bg-gray-100 text-gray-600',
  question_for_pediatrician: 'bg-purple-100 text-purple-700',
}

export default function EventList({ events }) {
  if (events.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 py-8">
        No entries yet — log something above.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map(ev => (
        <li key={ev.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          {ev.extracted ? <ExtractedEntry ev={ev} /> : <RawEntry ev={ev} />}
        </li>
      ))}
    </ul>
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
        <p className="text-sm text-gray-800 leading-relaxed">{eventToText(ev)}</p>
      </div>
      {ev.context_note && (
        <p className="mt-1.5 text-xs text-gray-400 italic pl-1">"{ev.context_note}"</p>
      )}
      <p className="mt-1.5 text-xs text-gray-300">
        {new Date(ev.timestamp_start).toLocaleString()}
      </p>
    </>
  )
}

function RawEntry({ ev }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-400">
          raw
        </span>
        <p className="text-sm text-gray-600 leading-relaxed">{ev.raw_text}</p>
      </div>
      <p className="mt-1.5 text-xs text-gray-300">
        {new Date(ev.timestamp_start).toLocaleString()}
      </p>
    </>
  )
}
