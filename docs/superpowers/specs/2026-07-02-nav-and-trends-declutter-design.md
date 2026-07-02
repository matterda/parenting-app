# Nav restructure + Trends declutter

## Problem

The app has grown to 7 equal-weight top tabs (Log, History, Trends, Develop,
Report, Ask, Settings) and the Trends tab alone packs a stat grid, five bar
charts, a scatter plot, a weight plot, and a timeline into one scroll. The
three tabs actually used day-to-day (Log, History, Trends) get no visual
priority over the four used rarely (Develop, Report, Ask, Settings).

## Section 1: Navigation restructure (`App.jsx`)

- **Header**: keeps the "Baby Log" title bar, gains a hamburger icon
  (top-left) that opens the drawer described below.
- **Bottom tab bar** (new, fixed to viewport bottom): Log, History, Trends —
  icon + label each. Replaces the current top tab row for these three.
- **Left drawer** (new): hamburger tap opens a panel from the left over
  a dimming scrim, listing Develop, Report, Ask, Settings. Tapping an item
  navigates and closes the drawer; tapping the scrim also closes it. Shows/hides
  instantly via conditional render, no animation.
- **State**: single `tab` state remains the source of truth, still persisted
  to `localStorage` under `active_tab`. Both the bottom bar and the drawer
  just call `setTab`.
- **Swipe gesture**: scoped down from all 7 tabs to just the 3 bottom-bar
  tabs (Log/History/Trends) — swiping should not land you in Settings by
  accident.
- **Icons**: no icon library is installed. Hand-roll small inline SVGs
  (pencil for Log, list for History, chart for Trends, hamburger)
  rather than add a dependency for five icons.

## Section 2: Trends view declutter (`TrendView.jsx`)

- **Today at a glance**: same 4 stat cards + 4 last-event lines, just
  tighter padding/gaps/font sizes to reduce vertical footprint. No content
  removed here.
- **Remove pumping entirely**: drop the "Pumping / day" bar chart and the
  "Pumping: yield vs duration" scatter section, plus the Pumping stat card
  in the glance header. Delete now-dead code: `GroupedBarRow`, `PumpScatter`,
  `fracColor` in `TrendView.jsx`, and `pumpingScatter` in
  `utils/aggregate.js`. `todayCounts()` itself is untouched — `askData.js`
  still reads `.pumping` off it.
- **Equal-width day-column bars**: add `min-w-0` to the per-day flex column
  in `BarRow`, `StackedBarRow`, and `FeedMilkBarRow`. Root cause: a flex
  item won't shrink below its label's natural content width, so a day with
  a wide label (e.g. "1200ml", "7.5h") was rendering wider than its
  neighbors, most visible at 30-day zoom where fewer labels are drawn.
  Labels are allowed to visually overflow their column's width now.
- **Taller weight plot**: `WeightPlot` gets its own track-height constant,
  independent of the `TRACK_PX` shared by the bar charts, doubled from 80px
  to 160px (matching the height `PumpScatter` already used, so not a novel
  scale in the file). `Gridlines` takes an optional `height` prop to support
  this without duplicating the component.

## Out of scope

- No changes to Log/History/Settings/Ask/Report/Develop view internals.
- No new dependencies.
- Timeline/Gantt view at the bottom of Trends is unchanged.
