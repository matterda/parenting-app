import { useState } from 'react'
import { baselineStatus, BASELINE_MAX_AGE_MS } from '../utils/weighFeed'

const UNITS = ['kg', 'g', 'lb', 'oz']
const LAST_UNIT_KEY = 'weighin_last_unit'

function fmtDur(ms) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

const reasonLabel = { diaper: 'diaper change', feed: 'a bottle/other feed', weight: 'an undressed weigh' }

// Log-tab card: shows whether a valid clothed baseline exists, and lets you
// record a weigh-in. After saving, the parent computes the feed-volume estimate
// and passes back a result to summarise here.
export default function WeighInCard({ events, onWeighIn }) {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState(() => localStorage.getItem(LAST_UNIT_KEY) || 'kg')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const status = baselineStatus(events)

  async function save() {
    const v = Number(value)
    if (!v || busy) return
    setBusy(true)
    localStorage.setItem(LAST_UNIT_KEY, unit)
    const res = await onWeighIn({ value: v, unit })
    setResult(res)
    setValue('')
    setBusy(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-base">⚖️</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Weigh-in (feed volume)</span>
      </div>

      {/* Baseline status */}
      <BaselineLine status={status} />

      {/* Entry */}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.005"
          placeholder="weight (clothed)"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          onClick={save}
          disabled={!value || busy}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40 transition"
        >
          {busy ? '…' : 'Save'}
        </button>
      </div>

      {result && <ResultLine result={result} />}
    </div>
  )
}

function BaselineLine({ status }) {
  if (status.state === 'none') {
    return <p className="text-xs text-gray-400 dark:text-gray-500">No baseline yet — weigh the baby (clothed) now, then again after a breastfeed to estimate the volume.</p>
  }
  const t = new Date(status.weighin.timestamp_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const w = `${status.weighin.data.value} ${status.weighin.data.unit}`
  if (status.state === 'valid') {
    return (
      <p className="text-xs text-green-600 dark:text-green-400">
        ✓ Baseline {w} at {t} — valid, expires in {fmtDur(status.expiresInMs)}. Breastfeed, then weigh again.
      </p>
    )
  }
  if (status.state === 'expired') {
    return <p className="text-xs text-amber-600 dark:text-amber-400">Baseline {w} at {t} is over {BASELINE_MAX_AGE_MS / 3600000} h old — weigh again for a fresh baseline.</p>
  }
  // invalidated
  const at = new Date(status.atMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <p className="text-xs text-amber-600 dark:text-amber-400">
      Baseline {w} at {t} invalidated by {reasonLabel[status.reason] ?? status.reason} at {at} — weigh again.
    </p>
  )
}

function ResultLine({ result }) {
  const cls = 'rounded-lg px-3 py-2 text-xs'
  switch (result.status) {
    case 'baseline':
      return <div className={`${cls} bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}>Saved as a new baseline.</div>
    case 'expired':
      return <div className={`${cls} bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300`}>Saved as a new baseline (previous one was too old to pair).</div>
    case 'invalid':
      return <div className={`${cls} bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300`}>Saved as a new baseline — couldn't estimate ({reasonLabel[result.reason] ?? result.reason} since the baseline).</div>
    case 'no_feed':
      return <div className={`${cls} bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}>Δ {result.deltaG > 0 ? '+' : ''}{Math.round(result.deltaG)} g, but no breastfeed in between — saved as a new baseline.</div>
    case 'ok': {
      if (result.deltaG <= 0) {
        return <div className={`${cls} bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300`}>Δ {Math.round(result.deltaG)} g — likely scale noise or spit-up, no volume recorded.</div>
      }
      const total = result.feeds.reduce((s, f) => s + (f.volume_ml || 0), 0)
      return (
        <div className={`${cls} bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300`}>
          Estimated {total} ml from Δ +{Math.round(result.deltaG)} g
          {result.multi ? ` across ${result.feeds.length} breastfeeds (split by duration)` : ''} — written to the feed.
        </div>
      )
    }
    default:
      return null
  }
}
