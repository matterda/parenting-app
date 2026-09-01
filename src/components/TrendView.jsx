import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { lastOfType, todayCounts, dailySeries, relativeTime, weightSeries } from '../utils/aggregate'
import { eventToText } from '../utils/eventToText'
import TimelineView from './TimelineView'
import { WHO_WEIGHT_FOR_AGE_KG, WHO_PERCENTILES, MS_PER_WHO_MONTH } from '../utils/whoWeightForAge'

export default function TrendView({ events }) {
  const [days, setDays] = useState(14)
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
  const series = dailySeries(events, days)
  const weights = weightSeries(events)

  return (
    <div className="flex flex-col gap-6">
      {/* Today at a glance */}
      <section>
        <h2 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Today at a glance</h2>
        <div className="grid grid-cols-3 gap-1.5">
          <StatCard label="Feeds" value={counts.feed} />
          <StatCard label="Sleeps" value={counts.sleep} />
          <StatCard label="Diapers" value={counts.diaper} />
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <LastLine label="Last feed" event={lastFeed} />
          <LastLine label="Last sleep" event={lastSleep} />
          <LastLine label="Last diaper" event={lastDiaper} />
        </div>
      </section>

      {/* Daily bars */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Last {days} days</h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  days === d ? 'bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <FeedMilkBarRow title="Feed volume / day (by milk type)" series={series} />
        <BarRow title="Breast feeds (latches) / day" series={series} field="feedsBreast" color="bg-blue-500" unit="" />
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
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 text-center shadow-sm">
      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{label}</div>
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
// One shared gutter width so every chart's plot area starts at the same x —
// otherwise each chart's own widest tick label (e.g. weight's "4500g" vs
// pumping's "80ml") pushes its bars/dots to a different offset.
const Y_AXIS_W = 40

// Tick positions as percentages from top: 0% = max, 50% = mid, 100% = 0
const TICK_PCTS = [0, 50, 100]

// Show at most ~6 x-axis labels regardless of how many days are plotted,
// evenly spaced and anchored so the most recent (rightmost) day always has
// one — avoids overlapping text once `days` grows past a week or two.
function labelStep(len) {
  return Math.max(1, Math.ceil(len / 6))
}

function YAxis({ max, unit = '' }) {
  const ticks = [max, max / 2, 0].map(v => Math.round(v * 10) / 10)
  return (
    <div className="relative pr-1 shrink-0" style={{ height: TRACK_PX, width: Y_AXIS_W }}>
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

function Gridlines({ height = TRACK_PX }) {
  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height }}>
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

// ─── BarRow ───────────────────────────────────────────────────────────────────
function BarRow({ title, series, field, color, unit }) {
  const [tooltip, setTooltip] = useState(null)
  const max = Math.max(...series.map(d => d[field]), 1)
  const step = labelStep(series.length)

  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{title}</div>
      <div className="flex items-start gap-1">
        <YAxis max={max} unit={unit} />
        <div className="flex-1 flex items-start gap-2">
          {series.map((d, i) => {
            const val = d[field]
            const px = val > 0 ? Math.max((val / max) * TRACK_PX, 4) : 0
            const showLabel = (series.length - 1 - i) % step === 0
            return (
              <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
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
                <div className="text-[10px] text-gray-500 dark:text-gray-400 h-3.5">{showLabel ? `${val}${unit}` : ''}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{showLabel ? d.label : ''}</div>
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
  const step = labelStep(series.length)

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
          {series.map((d, i) => {
            const total = d.diapersPee + d.diapersPoo
            // Strictly proportional so the stacked total matches the y-axis.
            const peePx = (d.diapersPee / max) * TRACK_PX
            const pooPx = (d.diapersPoo / max) * TRACK_PX
            const showLabel = (series.length - 1 - i) % step === 0
            return (
              <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
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
                <div className="text-[10px] text-gray-500 dark:text-gray-400 h-3.5">{showLabel ? total : ''}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{showLabel ? d.label : ''}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── FeedMilkBarRow ───────────────────────────────────────────────────────────
// Stacked bar of daily feed volume split into four categories: direct breast,
// bottle of expressed breast milk, bottle of formula, and other. Note direct
// breast feeds usually have no recorded volume, so they contribute little here.
function FeedMilkBarRow({ title, series }) {
  const [tooltip, setTooltip] = useState(null)
  const dayTotal = d => d.feedsBreastMl + d.feedsBottleBreastmilkMl + d.feedsBottleFormulaMl + d.feedsOtherMl
  const max = Math.max(...series.map(dayTotal), 1)
  const step = labelStep(series.length)

  // Segments drawn top→bottom; first non-zero from the top gets the rounded cap.
  const SEGMENTS = [
    { key: 'other',             field: 'feedsOtherMl',            cls: 'bg-gray-300 dark:bg-gray-600' },
    { key: 'bottle_formula',    field: 'feedsBottleFormulaMl',    cls: 'bg-orange-400' },
    { key: 'bottle_breastmilk', field: 'feedsBottleBreastmilkMl', cls: 'bg-sky-400' },
    { key: 'breast',            field: 'feedsBreastMl',           cls: 'bg-blue-500' },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500">{title}</span>
        <span className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />breast</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-sky-400" />bottle (BM)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-orange-400" />bottle (formula)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-gray-300 dark:bg-gray-600" />other</span>
        </span>
      </div>
      <div className="flex items-start gap-1">
        <YAxis max={max} unit="ml" />
        <div className="flex-1 flex items-start gap-2">
          {series.map((d, i) => {
            const totalMl = dayTotal(d)
            // Strictly proportional — no per-segment min height, so the stacked
            // total matches the y-axis scale exactly.
            const seg = v => (v / max) * TRACK_PX
            const topSeg = SEGMENTS.find(s => d[s.field] > 0)?.key
            // Anchor edge-day tooltips inward so they don't spill off-screen.
            const isFirst = i === 0
            const isLast = i === series.length - 1
            const tipPos = isFirst ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2'
            const showLabel = (series.length - 1 - i) % step === 0
            return (
              <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  {SEGMENTS.map(s => (
                    <div
                      key={s.key}
                      className={`relative w-full ${s.cls} ${topSeg === s.key ? 'rounded-t' : ''}`}
                      style={{ height: seg(d[s.field]) }}
                    />
                  ))}
                  {tooltip === d.key && totalMl > 0 && (
                    <div className={`absolute -top-16 ${tipPos} rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-2 py-1 whitespace-nowrap z-10 shadow flex flex-col gap-0.5`}>
                      {d.feedsBreastMl > 0 && <span>breast {d.feedsBreastMl}ml</span>}
                      {d.feedsBottleBreastmilkMl > 0 && <span>bottle (BM) {d.feedsBottleBreastmilkMl}ml</span>}
                      {d.feedsBottleFormulaMl > 0 && <span>bottle (formula) {d.feedsBottleFormulaMl}ml</span>}
                      {d.feedsOtherMl > 0 && <span>other {d.feedsOtherMl}ml</span>}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 h-3.5">{showLabel ? `${totalMl}ml` : ''}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{showLabel ? d.label : ''}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── WeightPlot ───────────────────────────────────────────────────────────────
// Scatter plot on a real time axis: dots sit at their actual measurement date,
// so gaps between weigh-ins are visible (unlike evenly-spaced bars).
//
// Zoom is horizontal-only: pinch (2 fingers) or ctrl/⌘+wheel changes how wide
// the plot's own scroll content is, and panning is just native horizontal
// scroll over that wider content — no custom pan gesture code needed. The
// y-axis re-fits to whichever weigh-ins are actually scrolled into view.
//
// WHO overlay: the 7 official percentile curves (p3…p97) drawn as lines, like
// a printed growth chart — median (p50) bold, the rest lighter/dashed.
const WHO_LINE_COLOR = '#16a34a'
// One style per WHO_PERCENTILES entry: [p3, p15, p25, p50, p75, p85, p97].
const WHO_LINE_STYLE = [
  { width: 1,    opacity: 0.35, dash: '3,3' },
  { width: 1,    opacity: 0.4,  dash: '3,3' },
  { width: 1,    opacity: 0.5,  dash: '3,3' },
  { width: 1.75, opacity: 0.8,  dash: null },
  { width: 1,    opacity: 0.5,  dash: '3,3' },
  { width: 1,    opacity: 0.4,  dash: '3,3' },
  { width: 1,    opacity: 0.35, dash: '3,3' },
]
// Weight gets its own (taller) track height, independent of the bar charts'
// shared TRACK_PX — makes it easier to see where each point sits vs. the WHO lines.
const WEIGHT_TRACK_PX = 160
const MIN_ZOOM = 1
const MAX_ZOOM = 20 // ~5% of the full time span at max zoom

function WeightPlot({ weights }) {
  const [tooltip, setTooltip] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollRef = useRef(null)
  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)
  const pendingCenterRef = useRef(null)

  const single = weights.length === 1

  // Reset zoom when the set of weigh-ins changes (e.g. a new one logged), so
  // a fresh point can't end up hidden outside a stale zoomed-in window.
  const weightsKey = weights.map(w => w.key).join(',')
  const [prevWeightsKey, setPrevWeightsKey] = useState(weightsKey)
  if (weightsKey !== prevWeightsKey) {
    setPrevWeightsKey(weightsKey)
    setZoomLevel(1)
  }

  // Measure the scroll container in real pixels — a percent-based SVG viewBox
  // stretched non-uniformly would render WHO line strokes thicker on steep
  // segments than flat ones.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep the visible center fixed across a zoom change instead of always
  // zooming from the left edge.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || pendingCenterRef.current == null) return
    const contentWidth = el.clientWidth * zoomLevel
    el.scrollLeft = pendingCenterRef.current * contentWidth - el.clientWidth / 2
    pendingCenterRef.current = null
  }, [zoomLevel])

  function applyZoom(nextRaw) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextRaw))
    const el = scrollRef.current
    if (el) {
      const contentWidth = el.clientWidth * zoomLevel
      pendingCenterRef.current = contentWidth > 0 ? (el.scrollLeft + el.clientWidth / 2) / contentWidth : 0.5
    }
    setZoomLevel(next)
  }

  function onPointerDown(e) {
    pointersRef.current.set(e.pointerId, e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (pointersRef.current.size === 2) {
      const [x1, x2] = [...pointersRef.current.values()]
      pinchRef.current = { startDist: Math.abs(x1 - x2) || 1, startZoom: zoomLevel }
    }
  }
  function onPointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, e.clientX)
    if (pointersRef.current.size === 2 && pinchRef.current) {
      e.preventDefault()
      const [x1, x2] = [...pointersRef.current.values()]
      applyZoom(pinchRef.current.startZoom * (Math.abs(x1 - x2) / pinchRef.current.startDist))
    }
  }
  function onPointerUp(e) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
  }

  // ctrl/⌘+wheel is trackpad-pinch (or an explicit zoom scroll); plain wheel
  // is left alone so the page keeps scrolling normally over the chart.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || single) return
    function onWheel(e) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      applyZoom(zoomLevel * Math.exp(-e.deltaY * 0.01))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomLevel, single])

  // Scale by kg-normalised values so 3000g and 3kg plot at the same height.
  const tValues = weights.map(w => w.ts)
  const tMin = Math.min(...tValues)
  const tMax = Math.max(...tValues)
  const tRange = tMax - tMin || 1

  const contentWidth = single ? viewportWidth : viewportWidth * zoomLevel
  const xPct = ts => (single ? 50 : ((ts - tMin) / tRange) * 100)
  const xPx  = ts => (xPct(ts) / 100) * contentWidth

  // Weigh-ins actually scrolled into view — the y-axis fits to these, not the
  // full history, so zooming/panning re-scales the axis to what's on screen.
  const visibleTMin = single || !contentWidth ? tMin : tMin + (scrollLeft / contentWidth) * tRange
  const visibleTMax = single || !contentWidth ? tMax : tMin + ((scrollLeft + viewportWidth) / contentWidth) * tRange
  const inView = weights.filter(w => w.ts >= visibleTMin && w.ts <= visibleTMax)
  const yWeights = inView.length > 0 ? inView : weights

  const kgValues = yWeights.map(w => w.valueKg)
  const min = Math.min(...kgValues)
  const max = Math.max(...kgValues)
  const range = max - min || 1

  const yPx = kg => Math.max(((kg - min) / range) * (WEIGHT_TRACK_PX - 16) + 8, 6)

  const babyDob = localStorage.getItem('baby_dob')
  const babySex = localStorage.getItem('baby_sex')
  const dobMs = babyDob ? new Date(babyDob).getTime() : null
  const canOverlay = !single && dobMs && (babySex === 'boy' || babySex === 'girl')

  // WHO monthly age points (0–24mo from DOB) padded one month past each edge
  // of the full data range, so line ends reach past the frame instead of
  // stopping mid-chart. Computed over the full range, not the zoomed view —
  // panning/zooming shouldn't make the reference lines pop in and out.
  let framePoints = []
  if (canOverlay) {
    const allMonths = Array.from({ length: 25 }, (_, m) => ({ month: m, ts: dobMs + m * MS_PER_WHO_MONTH }))
    let lo = allMonths.findIndex(p => p.ts >= tMin)
    lo = Math.max(0, (lo === -1 ? allMonths.length : lo) - 1)
    let hi = allMonths.length - 1
    while (hi > 0 && allMonths[hi].ts > tMax) hi--
    hi = Math.min(allMonths.length - 1, hi + 1)
    if (hi > lo) framePoints = allMonths.slice(lo, hi + 1)
  }
  const bandRows = framePoints.map(p => WHO_WEIGHT_FOR_AGE_KG[babySex][p.month])

  const fmt = ms => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const xTicks = single
    ? [{ pct: 50, label: fmt(tMin) }]
    : [
        { pct: 0,   label: fmt(visibleTMin) },
        { pct: 50,  label: fmt((visibleTMin + visibleTMax) / 2) },
        { pct: 100, label: fmt(visibleTMax) },
      ]

  return (
    <div className="flex flex-col gap-1">
      {!single && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">Pinch or ctrl+scroll to zoom</span>
          {zoomLevel > 1 && (
            <button onClick={() => setZoomLevel(1)} className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
              Reset zoom
            </button>
          )}
        </div>
      )}
      <div className="flex items-start gap-1">
        <div className="relative pr-1 shrink-0" style={{ height: WEIGHT_TRACK_PX, width: Y_AXIS_W }}>
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
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          style={{ touchAction: 'manipulation' }}
          onScroll={e => setScrollLeft(e.currentTarget.scrollLeft)}
          onPointerDown={single ? undefined : onPointerDown}
          onPointerMove={single ? undefined : onPointerMove}
          onPointerUp={single ? undefined : onPointerUp}
          onPointerCancel={single ? undefined : onPointerUp}
        >
          {/* Plot area — width grows with zoom; the div's own native scroll pans it */}
          <div className="relative" style={{ height: WEIGHT_TRACK_PX, width: single ? '100%' : contentWidth || '100%' }}>
            <Gridlines height={WEIGHT_TRACK_PX} />
            {framePoints.length >= 2 && contentWidth > 0 && (
              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${contentWidth} ${WEIGHT_TRACK_PX}`} preserveAspectRatio="none">
                {WHO_PERCENTILES.map((p, idx) => (
                  <polyline
                    key={p}
                    points={framePoints.map((fp, i) => `${xPx(fp.ts)},${WEIGHT_TRACK_PX - yPx(bandRows[i][idx])}`).join(' ')}
                    fill="none"
                    stroke={WHO_LINE_COLOR}
                    strokeWidth={WHO_LINE_STYLE[idx].width}
                    strokeOpacity={WHO_LINE_STYLE[idx].opacity}
                    strokeDasharray={WHO_LINE_STYLE[idx].dash ?? undefined}
                  />
                ))}
              </svg>
            )}
            {weights.map(w => (
              <button
                key={w.key}
                onClick={() => setTooltip(tooltip === w.key ? null : w.key)}
                className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900 cursor-pointer hover:scale-125 transition-transform"
                style={{ left: `${xPct(w.ts)}%`, bottom: `${yPx(w.valueKg)}px` }}
              >
                {tooltip === w.key && (
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10 shadow">
                    {w.value}{w.unit} · {w.date}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* X axis (time) — reflects whatever's currently scrolled/zoomed into view */}
      <div className="relative mt-1 h-3" style={{ marginLeft: Y_AXIS_W + 4 }}>
        {xTicks.map((t, i) => (
          <span
            key={i}
            className={`absolute text-[9px] text-gray-500 dark:text-gray-400 leading-none ${
              t.pct === 0 ? '' : t.pct === 100 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${t.pct}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
      {!canOverlay && !single && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Set baby's date of birth and sex in Settings to overlay the WHO growth-chart reference range.
        </p>
      )}
    </div>
  )
}

