import { useState } from 'react'
import { lastOfType, todayCounts, dailySeries, relativeTime, weightSeries } from '../utils/aggregate'
import { eventToText } from '../utils/eventToText'
import TimelineView from './TimelineView'

export default function TrendView({ events }) {
  const hasData = events.some(e => e.extracted)
  if (!hasData) {
    return (
      <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
        No extracted events yet — log a few and they'll show up here.
      </p>
    )
  }

  const counts = todayCounts(events)
  const lastFeed = lastOfType(events, 'feed')
  const lastSleep = lastOfType(events, 'sleep')
  const lastDiaper = lastOfType(events, 'diaper')
  const lastPumping = lastOfType(events, 'pumping')
  const series = dailySeries(events, 7)
  const weights = weightSeries(events)

  return (
    <div className="flex flex-col gap-6">
      {/* Today at a glance */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Today at a glance</h2>
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Feeds" value={counts.feed} />
          <StatCard label="Sleeps" value={counts.sleep} />
          <StatCard label="Diapers" value={counts.diaper} />
          <StatCard label="Pumping" value={counts.pumping} />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <LastLine label="Last feed" event={lastFeed} />
          <LastLine label="Last sleep" event={lastSleep} />
          <LastLine label="Last diaper" event={lastDiaper} />
          {lastPumping && <LastLine label="Last pumping" event={lastPumping} />}
        </div>
      </section>

      {/* 7-day bars */}
      <section className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Last 7 days</h2>
        <FeedMilkBarRow title="Feed volume / day (by milk type)" series={series} />
        <GroupedBarRow
          title="Pumping / day"
          series={series}
          fieldA="pumpings" labelA="count" colorA="bg-rose-400"
          fieldB="pumpingsVolumeMl" labelB="ml" colorB="bg-rose-200 dark:bg-rose-800"
          unitB="ml"
        />
        <BarRow title="Total sleep (hrs)" series={series} field="sleepHours" color="bg-indigo-400" unit="h" />
        <StackedBarRow title="Diapers / day" series={series} />
      </section>

      {/* Weight over time */}
      {weights.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Weight</h2>
          <WeightPlot weights={weights} />
        </section>
      )}

      {/* Timeline / Gantt */}
      <section className="flex flex-col gap-3">
        <TimelineView events={events} />
      </section>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center shadow-sm">
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
      <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{label}</div>
    </div>
  )
}

function LastLine({ label, event }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-800 dark:text-gray-100 text-right">
        {event ? (
          <>
            {eventToText(event).replace(/ · \d.*/, '')}{' '}
            <span className="text-gray-400 dark:text-gray-500">· {relativeTime(event.timestamp_start)}</span>
          </>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        )}
      </span>
    </div>
  )
}

// ─── shared chart constants ───────────────────────────────────────────────────
const TRACK_PX = 80
const Y_TICKS = 3

// Tick positions as percentages from top: 0% = max, 50% = mid, 100% = 0
const TICK_PCTS = [0, 50, 100]

function YAxis({ max, unit = '' }) {
  const ticks = [max, max / 2, 0].map(v => Math.round(v * 10) / 10)
  return (
    <div className="relative pr-1 shrink-0" style={{ height: TRACK_PX, width: 28 }}>
      {ticks.map((v, i) => (
        <span
          key={i}
          className="absolute right-1 text-[9px] text-gray-500 dark:text-gray-400 leading-none text-right -translate-y-1/2"
          style={{ top: `${TICK_PCTS[i]}%` }}
        >
          {v}{unit}
        </span>
      ))}
    </div>
  )
}

function Gridlines() {
  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: TRACK_PX }}>
      {TICK_PCTS.map(pct => (
        <div
          key={pct}
          className="absolute w-full border-t border-gray-100 dark:border-gray-800"
          style={{ top: `${pct}%` }}
        />
      ))}
    </div>
  )
}

// ─── GroupedBarRow ────────────────────────────────────────────────────────────
// Two side-by-side bars per day: fieldA (e.g. count) and fieldB (e.g. total ml).
// Each has its own scale so small counts and large ml values are both visible.
function GroupedBarRow({ title, series, fieldA, labelA, colorA, fieldB, labelB, colorB, unitA = '', unitB = '' }) {
  const [tooltip, setTooltip] = useState(null)
  const maxA = Math.max(...series.map(d => d[fieldA]), 1)
  const maxB = Math.max(...series.map(d => d[fieldB]), 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500">{title}</span>
        <span className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-sm ${colorA}`} />{labelA}
          </span>
          <span className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-sm ${colorB}`} />{labelB}
          </span>
        </span>
      </div>
      <div className="flex items-start gap-1">
        <YAxis max={maxA} unit={unitA} />
        <div className="flex-1 flex items-start gap-2">
          {series.map(d => {
            const valA = d[fieldA]
            const valB = d[fieldB]
            const pxA = valA > 0 ? Math.max((valA / maxA) * TRACK_PX, 4) : 0
            const pxB = valB > 0 ? Math.max((valB / maxB) * TRACK_PX, 4) : 0
            const key = d.key
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                <div className="relative w-full flex items-end gap-0.5" style={{ height: TRACK_PX }}>
                  <Gridlines />
                  {/* Bar A */}
                  <div
                    className={`relative flex-1 rounded-t ${colorA} cursor-pointer hover:opacity-75 transition-opacity`}
                    style={{ height: pxA }}
                    onClick={() => setTooltip(tooltip === key + 'a' ? null : key + 'a')}
                  >
                    {tooltip === key + 'a' && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10 shadow">
                        {valA}{unitA}
                      </div>
                    )}
                  </div>
                  {/* Bar B */}
                  <div
                    className={`relative flex-1 rounded-t ${colorB} cursor-pointer hover:opacity-75 transition-opacity`}
                    style={{ height: pxB }}
                    onClick={() => setTooltip(tooltip === key + 'b' ? null : key + 'b')}
                  >
                    {tooltip === key + 'b' && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10 shadow">
                        {valB}{unitB}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{d.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── BarRow ───────────────────────────────────────────────────────────────────
function BarRow({ title, series, field, color, unit }) {
  const [tooltip, setTooltip] = useState(null)
  const max = Math.max(...series.map(d => d[field]), 1)

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{title}</div>
      <div className="flex items-start gap-1">
        <YAxis max={max} unit={unit} />
        <div className="flex-1 flex items-start gap-2">
          {series.map(d => {
            const val = d[field]
            const px = val > 0 ? Math.max((val / max) * TRACK_PX, 4) : 0
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="relative w-full flex items-end justify-center" style={{ height: TRACK_PX }}>
                  <Gridlines />
                  <div
                    className={`relative w-full rounded-t ${color} cursor-pointer hover:opacity-75 transition-opacity`}
                    style={{ height: px }}
                    onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                  >
                    {tooltip === d.key && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10 shadow">
                        {val}{unit}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{val}{unit}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{d.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── StackedBarRow ────────────────────────────────────────────────────────────
function StackedBarRow({ title, series }) {
  const [tooltip, setTooltip] = useState(null)
  const max = Math.max(...series.map(d => d.diapersPee + d.diapersPoo), 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500">{title}</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="inline-block w-2 h-2 rounded-sm bg-yellow-400" /> pee
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-700 ml-1" /> poo
        </span>
      </div>
      <div className="flex items-start gap-1">
        <YAxis max={max} />
        <div className="flex-1 flex items-start gap-2">
          {series.map(d => {
            const total = d.diapersPee + d.diapersPoo
            // Strictly proportional so the stacked total matches the y-axis.
            const peePx = (d.diapersPee / max) * TRACK_PX
            const pooPx = (d.diapersPoo / max) * TRACK_PX
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  <div className="relative w-full rounded-t bg-amber-700" style={{ height: pooPx }} />
                  <div className="relative w-full bg-yellow-400" style={{ height: peePx }} />
                  {tooltip === d.key && total > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10 shadow">
                      pee {d.diapersPee} · poo {d.diapersPoo}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{total}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{d.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── FeedMilkBarRow ───────────────────────────────────────────────────────────
// Stacked bar of daily feed counts split by milk type: breast milk, formula,
// and other (milk type not recorded). Tooltip also surfaces volume where known.
function FeedMilkBarRow({ title, series }) {
  const [tooltip, setTooltip] = useState(null)
  const max = Math.max(...series.map(d => d.feedsBreastMl + d.feedsFormulaMl + d.feedsOtherMl), 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500">{title}</span>
        <span className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-400" />breast</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-orange-400" />formula</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-gray-300 dark:bg-gray-600" />other</span>
        </span>
      </div>
      <div className="flex items-start gap-1">
        <YAxis max={max} unit="ml" />
        <div className="flex-1 flex items-start gap-2">
          {series.map((d, i) => {
            const totalMl = d.feedsBreastMl + d.feedsFormulaMl + d.feedsOtherMl
            // Strictly proportional — no per-segment min height, so the stacked
            // total matches the y-axis scale exactly.
            const seg = v => (v / max) * TRACK_PX
            // Round only the topmost non-zero segment (DOM order top→bottom is
            // other, formula, breast) so inner segment joins stay square.
            const topSeg = d.feedsOtherMl > 0 ? 'other' : d.feedsFormulaMl > 0 ? 'formula' : 'breast'
            // Anchor edge-day tooltips inward so they don't spill off-screen.
            const isFirst = i === 0
            const isLast = i === series.length - 1
            const tipPos = isFirst ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2'
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  <div className={`relative w-full bg-gray-300 dark:bg-gray-600 ${topSeg === 'other' ? 'rounded-t' : ''}`} style={{ height: seg(d.feedsOtherMl) }} />
                  <div className={`relative w-full bg-orange-400 ${topSeg === 'formula' ? 'rounded-t' : ''}`} style={{ height: seg(d.feedsFormulaMl) }} />
                  <div className={`relative w-full bg-blue-400 ${topSeg === 'breast' ? 'rounded-t' : ''}`} style={{ height: seg(d.feedsBreastMl) }} />
                  {tooltip === d.key && totalMl > 0 && (
                    <div className={`absolute -top-10 ${tipPos} rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-2 py-1 whitespace-nowrap z-10 shadow flex flex-col gap-0.5`}>
                      <span>breast milk {d.feedsBreastMl}ml</span>
                      <span>formula {d.feedsFormulaMl}ml</span>
                      {d.feedsOtherMl > 0 && <span>other {d.feedsOtherMl}ml</span>}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{totalMl}ml</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{d.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── WeightPlot ───────────────────────────────────────────────────────────────
function WeightPlot({ weights }) {
  const [tooltip, setTooltip] = useState(null)
  // Scale by kg-normalised values so 3000g and 3kg plot at the same height
  const kgValues = weights.map(w => w.valueKg)
  const min   = Math.min(...kgValues)
  const max   = Math.max(...kgValues)
  const range = max - min || 1

  return (
    <div className="flex items-start gap-1">
      <div className="relative pr-1 shrink-0" style={{ height: TRACK_PX, width: 40 }}>
        {[max, (max + min) / 2, min].map((v, i) => (
          <span
            key={i}
            className="absolute right-1 text-[9px] text-gray-500 dark:text-gray-400 leading-none text-right -translate-y-1/2"
            style={{ top: `${TICK_PCTS[i]}%` }}
          >
            {Math.round(v * 1000)}g
          </span>
        ))}
      </div>
      <div className="flex-1 flex items-start gap-2">
        {weights.map(w => {
          const px = Math.max(((w.valueKg - min) / range) * (TRACK_PX - 12) + 12, 8)
          return (
            <div key={w.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex items-end justify-center" style={{ height: TRACK_PX }}>
                <Gridlines />
                <div
                  className="relative w-full rounded-t bg-green-400 cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: px }}
                  onClick={() => setTooltip(tooltip === w.key ? null : w.key)}
                >
                  {tooltip === w.key && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10 shadow">
                      {w.value}{w.unit}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">{w.value}{w.unit}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">{w.date}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
