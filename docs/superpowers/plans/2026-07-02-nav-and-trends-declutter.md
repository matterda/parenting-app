# Nav restructure + Trends declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the app's flat 7-tab nav into a bottom bar (Log/History/Trends) + hamburger drawer (Develop/Report/Ask/Settings), and declutter the Trends view (drop pumping charts, fix uneven bar widths, taller weight plot).

**Architecture:** Pure React/Tailwind changes to `src/App.jsx` and `src/components/TrendView.jsx`, plus two new presentational components (`BottomNav.jsx`, `NavDrawer.jsx`) and one new icon module (`icons.jsx`). No new dependencies, no backend/data-model changes — `tab` stays the single source of navigation truth in `App.jsx` state.

**Tech Stack:** React 18, Tailwind CSS 3, Vite. No test framework is installed in this repo (`package.json` has no test runner) — verification is `npm run build` (catches syntax/import errors) plus manual check in the Vite dev server, per this project's convention and this plan's Global Constraints below.

## Global Constraints

- No new npm dependencies (spec: hand-roll icons, hand-roll the drawer — no icon library, no animation library).
- Follow existing Tailwind conventions already in the touched files: `dark:` variants on every color class, `violet-600`/`violet-400` for active/accent state, `gray-*` scale for neutral text, rounded corners (`rounded-xl`/`rounded-lg`), the existing `pt-safe`/`pb-safe` class names for safe-area padding (present in `App.jsx` today — replicate the convention, do not attempt to fix or redefine it, that's out of scope).
- This repo has no test framework. Each task's verification step is: `npm run build` (must succeed with no errors) + a manual check against the running dev server (`npm run dev`), per this repo's convention and the standing instruction to verify UI changes in a browser before calling them done.
- Every task must leave `npm run build` passing and the app fully navigable — no task should land in a state where a tab is unreachable.

---

## Task 1: Remove pumping from Trends

**Files:**
- Modify: `src/components/TrendView.jsx`
- Modify: `src/utils/aggregate.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TrendView` no longer renders any pumping UI; `pumpingScatter`, `GroupedBarRow`, `PumpScatter`, `fracColor` no longer exist anywhere in the codebase (dead code deleted, not left unused).

- [ ] **Step 1: Drop the `pumpingScatter` import and the pumping stat/lines from the glance header**

In `src/components/TrendView.jsx`, change the import line:

```jsx
import { lastOfType, todayCounts, dailySeries, relativeTime, weightSeries, pumpingScatter } from '../utils/aggregate'
```

to:

```jsx
import { lastOfType, todayCounts, dailySeries, relativeTime, weightSeries } from '../utils/aggregate'
```

Then replace this block (the component body from the `days` state through the end of the "Today at a glance" section):

```jsx
  const [days, setDays] = useState(14)
  const counts = todayCounts(events)
  const lastFeed = lastOfType(events, 'feed')
  const lastSleep = lastOfType(events, 'sleep')
  const lastDiaper = lastOfType(events, 'diaper')
  const lastPumping = lastOfType(events, 'pumping')
  const series = dailySeries(events, days)
  const weights = weightSeries(events)
  const pumps = pumpingScatter(events)

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
```

with:

```jsx
  const [days, setDays] = useState(14)
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
```

(`counts.pumping` from `todayCounts()` is simply no longer read here — leave `todayCounts()` itself unchanged in `aggregate.js`, `src/askData.js` still depends on the `pumping` field it returns.)

- [ ] **Step 2: Tighten the `StatCard` component to match the smaller glance header**

Replace:

```jsx
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center shadow-sm">
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
      <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{label}</div>
    </div>
  )
}
```

with:

```jsx
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 text-center shadow-sm">
      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{label}</div>
    </div>
  )
}
```

- [ ] **Step 3: Remove the "Pumping / day" bar chart and the "Pumping: yield vs duration" section**

Replace:

```jsx
        <FeedMilkBarRow title="Feed volume / day (by milk type)" series={series} />
        <BarRow title="Breast feeds (latches) / day" series={series} field="feedsBreast" color="bg-blue-500" unit="" />
        <GroupedBarRow
          title="Pumping / day"
          series={series}
          fieldA="pumpingsBreasts" labelA="breasts" colorA="bg-rose-400"
          fieldB="pumpingsVolumeMl" labelB="ml" colorB="bg-rose-200 dark:bg-rose-800"
          unitB="ml"
        />
        <BarRow title="Total sleep (hrs)" series={series} field="sleepHours" color="bg-indigo-400" unit="h" />
        <StackedBarRow title="Diapers / day" series={series} />
      </section>

      {/* Pumping: volume vs duration */}
      {pumps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pumping: yield vs duration</h2>
          <PumpScatter points={pumps} />
        </section>
      )}

      {/* Weight over time */}
```

with:

```jsx
        <FeedMilkBarRow title="Feed volume / day (by milk type)" series={series} />
        <BarRow title="Breast feeds (latches) / day" series={series} field="feedsBreast" color="bg-blue-500" unit="" />
        <BarRow title="Total sleep (hrs)" series={series} field="sleepHours" color="bg-indigo-400" unit="h" />
        <StackedBarRow title="Diapers / day" series={series} />
      </section>

      {/* Weight over time */}
```

- [ ] **Step 4: Delete the now-dead `GroupedBarRow`, `PumpScatter`, and `fracColor` functions**

In `src/components/TrendView.jsx`, delete the entire `GroupedBarRow` function block (the section headed `// ─── GroupedBarRow ───...` through its closing `}`, currently just above `// ─── BarRow ───...`).

Also delete the entire `// ─── PumpScatter ───...` section at the end of the file — the `fracColor` function and the `PumpScatter` function — since neither is referenced anywhere after this task's other steps.

- [ ] **Step 5: Delete the now-dead `pumpingScatter` export from `aggregate.js`**

Read `src/utils/aggregate.js` around line 176 to find the full `pumpingScatter` function body, and delete it entirely (function signature through its closing `}`). Confirm nothing else in the repo imports it:

```bash
grep -rn "pumpingScatter" src/
```

Expected: no matches.

- [ ] **Step 6: Verify build and behavior**

```bash
npm run build
```

Expected: succeeds with no errors (confirms no leftover references to deleted functions/imports).

Then start the dev server and open the Trends tab: confirm "Today at a glance" shows 3 stat cards (no Pumping), no "Pumping / day" bar chart, and no "Pumping: yield vs duration" section.

- [ ] **Step 7: Commit**

```bash
git add src/components/TrendView.jsx src/utils/aggregate.js
git commit -m "Remove pumping charts from Trends view"
```

---

## Task 2: Equal-width day-column bars

**Files:**
- Modify: `src/components/TrendView.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no behavior change to props/signatures — purely a CSS class fix inside `BarRow`, `StackedBarRow`, and `FeedMilkBarRow`.

- [ ] **Step 1: Add `min-w-0` to the per-day column in `BarRow`**

Replace:

```jsx
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
                <div className="text-[10px] text-gray-500 dark:text-gray-400 h-3.5">{showLabel ? `${val}${unit}` : ''}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{showLabel ? d.label : ''}</div>
              </div>
```

with (only the outer `className` changes, from `"flex-1 flex flex-col items-center gap-1"` to `"flex-1 min-w-0 flex flex-col items-center gap-1"`):

```jsx
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
```

- [ ] **Step 2: Add `min-w-0` to the per-day column in `StackedBarRow`**

In the `StackedBarRow` function, change:

```jsx
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  <div className="relative w-full rounded-t bg-amber-700" style={{ height: pooPx }} />
                  <div className="relative w-full bg-yellow-400" style={{ height: peePx }} />
```

to:

```jsx
              <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  <div className="relative w-full rounded-t bg-amber-700" style={{ height: pooPx }} />
                  <div className="relative w-full bg-yellow-400" style={{ height: peePx }} />
```

- [ ] **Step 3: Add `min-w-0` to the per-day column in `FeedMilkBarRow`**

In the `FeedMilkBarRow` function, change:

```jsx
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  {SEGMENTS.map(s => (
```

to:

```jsx
              <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div
                  className="relative w-full flex flex-col justify-end cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ height: TRACK_PX }}
                  onClick={() => setTooltip(tooltip === d.key ? null : d.key)}
                >
                  <Gridlines />
                  {SEGMENTS.map(s => (
```

- [ ] **Step 4: Verify build and behavior**

```bash
npm run build
```

Expected: succeeds with no errors.

Then in the dev server, open Trends, switch the day-range selector to 30d, and check "Feed volume / day" and "Total sleep (hrs)" — every bar/column should be the same width, even where a label (e.g. "1200ml") is wider than its bar.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendView.jsx
git commit -m "Fix uneven day-column bar widths in Trends charts"
```

---

## Task 3: Taller weight plot

**Files:**
- Modify: `src/components/TrendView.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Gridlines` gains an optional `height` prop (defaults to `TRACK_PX`, so every other caller is unaffected); `WeightPlot` renders at a new `WEIGHT_TRACK_PX` (160) instead of the shared `TRACK_PX` (80).

- [ ] **Step 1: Give `Gridlines` an optional `height` prop**

Replace:

```jsx
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
```

with:

```jsx
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
```

- [ ] **Step 2: Add a `WEIGHT_TRACK_PX` constant next to the WHO overlay constants**

Replace:

```jsx
const WHO_BAND_COLOR = '#22c55e'
const WHO_BAND_OPACITY = 0.12
const WHO_BANDS = [[0, 6], [1, 5], [2, 4]] // indices into WHO_PERCENTILES: [p3,p97] [p15,p85] [p25,p75]
```

with:

```jsx
const WHO_BAND_COLOR = '#22c55e'
const WHO_BAND_OPACITY = 0.12
const WHO_BANDS = [[0, 6], [1, 5], [2, 4]] // indices into WHO_PERCENTILES: [p3,p97] [p15,p85] [p25,p75]
// Weight gets its own (taller) track height, independent of the bar charts'
// shared TRACK_PX — makes it easier to see where each point sits in the WHO bands.
const WEIGHT_TRACK_PX = 160
```

- [ ] **Step 3: Use `WEIGHT_TRACK_PX` throughout `WeightPlot` instead of `TRACK_PX`**

Replace:

```jsx
  const xPct = ts => (single ? 50 : ((ts - tMin) / tRange) * 100)
  const yPx  = kg => Math.max(((kg - min) / range) * (TRACK_PX - 16) + 8, 6)

  const bandPolygon = (loIdx, hiIdx) => {
    const top = framePoints.map((p, i) => `${xPct(p.ts)},${TRACK_PX - yPx(bandRows[i][hiIdx])}`)
    const bottom = framePoints.map((p, i) => `${xPct(p.ts)},${TRACK_PX - yPx(bandRows[i][loIdx])}`).reverse()
    return [...top, ...bottom].join(' ')
  }
```

with:

```jsx
  const xPct = ts => (single ? 50 : ((ts - tMin) / tRange) * 100)
  const yPx  = kg => Math.max(((kg - min) / range) * (WEIGHT_TRACK_PX - 16) + 8, 6)

  const bandPolygon = (loIdx, hiIdx) => {
    const top = framePoints.map((p, i) => `${xPct(p.ts)},${WEIGHT_TRACK_PX - yPx(bandRows[i][hiIdx])}`)
    const bottom = framePoints.map((p, i) => `${xPct(p.ts)},${WEIGHT_TRACK_PX - yPx(bandRows[i][loIdx])}`).reverse()
    return [...top, ...bottom].join(' ')
  }
```

Then replace:

```jsx
        <div className="relative pr-1 shrink-0" style={{ height: TRACK_PX, width: Y_AXIS_W }}>
```

with:

```jsx
        <div className="relative pr-1 shrink-0" style={{ height: WEIGHT_TRACK_PX, width: Y_AXIS_W }}>
```

Then replace:

```jsx
          <div className="relative w-full" style={{ height: TRACK_PX }}>
            <Gridlines />
```

with:

```jsx
          <div className="relative w-full" style={{ height: WEIGHT_TRACK_PX }}>
            <Gridlines height={WEIGHT_TRACK_PX} />
```

- [ ] **Step 4: Verify build and behavior**

```bash
npm run build
```

Expected: succeeds with no errors.

Then in the dev server, open Trends and check the Weight section: the plot area should now be visibly taller (160px vs the old 80px) and, if DOB/sex are set in Settings, the WHO reference bands should still render aligned behind the dots with no visual glitches (gridlines still span the full height, dots still sit at the right y position).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendView.jsx
git commit -m "Give the weight plot its own taller track height"
```

---

## Task 4: Navigation restructure — bottom bar + drawer

**Files:**
- Create: `src/components/icons.jsx`
- Create: `src/components/BottomNav.jsx`
- Create: `src/components/NavDrawer.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of Tasks 1–3).
- Produces:
  - `icons.jsx` exports `PencilIcon`, `ListIcon`, `ChartIcon`, `MenuIcon` — each `({ className }) => JSX`, `className` optional with a sane default.
  - `BottomNav.jsx` default-exports `BottomNav({ tab, onSelect, disabled })` — `tab: string`, `onSelect: (tab: string) => void`, `disabled: boolean`.
  - `NavDrawer.jsx` default-exports `NavDrawer({ open, tab, onSelect, onClose })` — `open: boolean`, `tab: string`, `onSelect: (tab: string) => void`, `onClose: () => void`.
  - `App.jsx` gains a `menuOpen` state and a `PRIMARY_TABS`/`MENU_TABS` split of the existing `TABS` array.

- [ ] **Step 1: Create the icon module**

Create `src/components/icons.jsx`:

```jsx
// Small hand-rolled stroke icons (no icon library dependency) — each takes an
// optional `className` for sizing/color via Tailwind (they use currentColor).
export function PencilIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function ListIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
      <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
    </svg>
  )
}

export function ChartIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4" /><path d="M12 16V8" /><path d="M17 16v-7" />
    </svg>
  )
}

export function MenuIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
    </svg>
  )
}
```

- [ ] **Step 2: Create the bottom nav bar**

Create `src/components/BottomNav.jsx`:

```jsx
import { PencilIcon, ListIcon, ChartIcon } from './icons'

const ITEMS = [
  { tab: 'Log', label: 'Log', Icon: PencilIcon },
  { tab: 'History', label: 'History', Icon: ListIcon },
  { tab: 'Trends', label: 'Trends', Icon: ChartIcon },
]

export default function BottomNav({ tab, onSelect, disabled }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pb-safe">
      {ITEMS.map(({ tab: t, label, Icon }) => (
        <button
          key={t}
          onClick={() => { if (!disabled) onSelect(t) }}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
            tab === t
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
          } ${disabled ? 'opacity-40 cursor-default' : ''}`}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Create the nav drawer**

Create `src/components/NavDrawer.jsx`:

```jsx
const ITEMS = ['Develop', 'Report', 'Ask', 'Settings']

export default function NavDrawer({ open, tab, onSelect, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-64 max-w-[80%] bg-white dark:bg-gray-900 shadow-xl pt-safe flex flex-col">
        <div className="px-4 py-4 text-sm font-semibold text-gray-400 dark:text-gray-500">More</div>
        <nav className="flex flex-col">
          {ITEMS.map(t => (
            <button
              key={t}
              onClick={() => { onSelect(t); onClose() }}
              className={`text-left px-4 py-3 text-sm font-medium transition ${
                tab === t
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire both into `App.jsx`**

Add the new imports. In `src/App.jsx`, replace:

```jsx
import ReportView from './components/ReportView'
import AskView from './components/AskView'
import DevelopView from './components/DevelopView'

const TABS = ['Log', 'History', 'Trends', 'Develop', 'Report', 'Ask', 'Settings']
```

with:

```jsx
import ReportView from './components/ReportView'
import AskView from './components/AskView'
import DevelopView from './components/DevelopView'
import BottomNav from './components/BottomNav'
import NavDrawer from './components/NavDrawer'
import { MenuIcon } from './components/icons'

const PRIMARY_TABS = ['Log', 'History', 'Trends']
const MENU_TABS = ['Develop', 'Report', 'Ask', 'Settings']
const TABS = [...PRIMARY_TABS, ...MENU_TABS]
```

Add `menuOpen` state next to the existing `tab` state. Replace:

```jsx
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('active_tab')
    return TABS.includes(saved) ? saved : 'Log'
  })
  const [events, setEvents] = useState([])
```

with:

```jsx
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('active_tab')
    return TABS.includes(saved) ? saved : 'Log'
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [events, setEvents] = useState([])
```

Scope the swipe handler to `PRIMARY_TABS`. Replace:

```jsx
  const handleTouchEnd = useCallback(e => {
    if (touchStartX.current === null || phase !== 'idle') return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Ignore if mostly vertical (scrolling)
    if (Math.abs(dy) > Math.abs(dx)) return
    // Require at least 60px horizontal swipe
    if (Math.abs(dx) < 60) return
    const idx = TABS.indexOf(tab)
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1])
    if (dx > 0 && idx > 0)               setTab(TABS[idx - 1])
  }, [phase, tab])
```

with:

```jsx
  const handleTouchEnd = useCallback(e => {
    if (touchStartX.current === null || phase !== 'idle') return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Ignore if mostly vertical (scrolling)
    if (Math.abs(dy) > Math.abs(dx)) return
    // Require at least 60px horizontal swipe
    if (Math.abs(dx) < 60) return
    // Swipe only cycles the bottom-bar tabs — menu tabs are reached via the drawer.
    const idx = PRIMARY_TABS.indexOf(tab)
    if (idx === -1) return
    if (dx < 0 && idx < PRIMARY_TABS.length - 1) setTab(PRIMARY_TABS[idx + 1])
    if (dx > 0 && idx > 0)                        setTab(PRIMARY_TABS[idx - 1])
  }, [phase, tab])
```

Replace the header/nav/main-open block. Replace:

```jsx
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-violet-600 dark:bg-violet-800 px-4 pt-safe pb-3 shadow-md">
        <h1 className="text-lg font-bold text-white tracking-tight">Baby Log</h1>
      </header>

      <nav className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => { if (phase === 'idle') setTab(t) }}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t
                ? 'border-b-2 border-violet-600 text-violet-600 dark:text-violet-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            } ${phase !== 'idle' ? 'opacity-40 cursor-default' : ''}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main
        className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
```

with:

```jsx
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="flex items-center gap-3 bg-violet-600 dark:bg-violet-800 px-4 pt-safe pb-3 shadow-md">
        <button
          onClick={() => { if (phase === 'idle') setMenuOpen(true) }}
          className={`text-white ${phase !== 'idle' ? 'opacity-40 cursor-default' : ''}`}
          aria-label="Open menu"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-white tracking-tight">Baby Log</h1>
      </header>

      <NavDrawer
        open={menuOpen}
        tab={tab}
        onSelect={t => { if (phase === 'idle') setTab(t) }}
        onClose={() => setMenuOpen(false)}
      />

      <main
        className="flex-1 overflow-y-auto p-4 pb-20 max-w-xl mx-auto w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
```

(`pb-20` on `<main>` keeps content clear of the new fixed bottom bar.)

Finally, add the `BottomNav` right before the closing tags at the end of the component. Replace:

```jsx
        {phase === 'idle' && tab === 'Settings' && (
          <Settings
            onNotifSettingsChanged={() => scheduleCheck(events)}
            onRestore={handleRestore}
          />
        )}
      </main>
    </div>
  )
}
```

with:

```jsx
        {phase === 'idle' && tab === 'Settings' && (
          <Settings
            onNotifSettingsChanged={() => scheduleCheck(events)}
            onRestore={handleRestore}
          />
        )}
      </main>

      <BottomNav
        tab={tab}
        onSelect={t => { if (phase === 'idle') setTab(t) }}
        disabled={phase !== 'idle'}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify build and behavior**

```bash
npm run build
```

Expected: succeeds with no errors.

Then start the dev server and manually check, for both light and dark mode:
- The bottom bar shows Log/History/Trends with icons, and tapping each switches `tab` and highlights the active one in violet.
- The hamburger icon in the header opens the drawer with Develop/Report/Ask/Settings; tapping an item navigates there and closes the drawer; tapping the dark overlay also closes it.
- Navigating to a drawer tab (e.g. Settings) and then reloading the page keeps you on that tab (the `active_tab` localStorage persistence still works).
- Swiping left/right only moves between Log/History/Trends; it does nothing while on a drawer tab (e.g. Settings).
- Page content isn't hidden behind the bottom bar on any tab (check History and Trends, which are the longest-scrolling views).

- [ ] **Step 6: Commit**

```bash
git add src/components/icons.jsx src/components/BottomNav.jsx src/components/NavDrawer.jsx src/App.jsx
git commit -m "Restructure navigation into a bottom bar + hamburger drawer"
```
