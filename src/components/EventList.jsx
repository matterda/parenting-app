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
          <p className="text-base text-gray-800 leading-relaxed">{ev.raw_text}</p>
          <p className="mt-1.5 text-xs text-gray-400">
            {new Date(ev.timestamp_start).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  )
}
