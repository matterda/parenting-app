import { lastOfType, todayCounts, dailySeries, relativeTime } from '../utils/aggregate'
import { eventToText } from '../utils/eventToText'

export default function TrendView({ events }) {
  const hasData = events.some(e => e.extracted)
  if (!hasData) {
    return (
      <p className="text-center text-sm text-gray-400 py-8">
        No extracted events yet — log a few and they'll show up here.
      </p>
    )
  }

  const counts = todayCounts(events)
  const lastFeed = lastOfType(events, 'feed')
  const lastSleep = lastOfType(events, 'sleep')
  const lastDiaper = lastOfType(events, 'diaper')
  const series = dailySeries(events, 7)

  return (
    <div className="flex flex-col gap-6">
      {/* Today at a glance */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Today at a glance</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Feeds" value={counts.feed} />
          <StatCard label="Sleeps" value={counts.sleep} />
          <StatCard label="Diapers" value={counts.diaper} />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <LastLine label="Last feed" event={lastFeed} />
          <LastLine label="Last sleep" event={lastSleep} />
          <LastLine label="Last diaper" event={lastDiaper} />
        </div>
      </section>

      {/* 7-day bars */}
      <section className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Last 7 days</h2>
        <BarRow title="Feeds / day" series={series} field="feeds" color="bg-blue-400" />
        <BarRow title="Total sleep (hrs)" series={series} field="sleepHours" color="bg-indigo-400" />
        <BarRow title="Diapers / day" series={series} field="diapers" color="bg-yellow-400" />
      </section>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}

function LastLine({ label, event }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 text-right">
        {event ? (
          <>
            {eventToText(event).replace(/ · \d.*/, '')}{' '}
            <span className="text-gray-400">· {relativeTime(event.timestamp_start)}</span>
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </span>
    </div>
  )
}

const TRACK_PX = 80

function BarRow({ title, series, field, color }) {
  const max = Math.max(...series.map(d => d[field]), 1)
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1.5">{title}</div>
      <div className="flex items-end gap-2">
        {series.map(d => {
          const val = d[field]
          const px = val > 0 ? Math.max((val / max) * TRACK_PX, 4) : 0
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: TRACK_PX }}>
                <div
                  className={`w-full rounded-t ${color}`}
                  style={{ height: px }}
                  title={`${val}`}
                />
              </div>
              <div className="text-[10px] text-gray-500">{val}</div>
              <div className="text-[10px] text-gray-300">{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
