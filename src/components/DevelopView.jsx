import { useState } from 'react'
import { EXPERIMENTS, DOMAINS } from '../devCatalog'

const RESULTS = [
  { key: 'observed', label: 'Observed', cls: 'bg-green-600 text-white', dim: 'text-green-600 dark:text-green-400' },
  { key: 'emerging', label: 'Emerging', cls: 'bg-amber-500 text-white', dim: 'text-amber-600 dark:text-amber-400' },
  { key: 'not_yet', label: 'Not yet', cls: 'bg-gray-400 text-white', dim: 'text-gray-500 dark:text-gray-400' },
]
const RESULT_BY_KEY = Object.fromEntries(RESULTS.map(r => [r.key, r]))
const RANK = { observed: 3, emerging: 2, not_yet: 1 }

function ageWeeks() {
  const dob = localStorage.getItem('baby_dob')
  if (!dob) return null
  const ms = Date.now() - new Date(dob).getTime()
  return ms / (7 * 86_400_000)
}

function weeksLabel(start, end) {
  return `wk ${start}–${end}`
}

export default function DevelopView({ events, onLog }) {
  const weeks = ageWeeks()

  if (weeks == null) {
    return (
      <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
        Set your baby's date of birth in Settings to see age-matched activities.
      </p>
    )
  }

  // Latest result + first-observed date per experiment, from logged devchecks.
  const byExp = {}
  for (const e of events) {
    if (!e.extracted || e.type !== 'devcheck' || !e.data?.experiment_id) continue
    const id = e.data.experiment_id
    const slot = byExp[id] ?? (byExp[id] = { latest: null, latestTs: 0, observedTs: null })
    const t = new Date(e.timestamp_start).getTime()
    if (t >= slot.latestTs) { slot.latestTs = t; slot.latest = e.data.result }
    if (e.data.result === 'observed' && (slot.observedTs == null || t < slot.observedTs)) slot.observedTs = t
  }

  const logged = [], tryNow = [], soon = []
  for (const exp of EXPERIMENTS) {
    if (byExp[exp.id]) logged.push(exp)
    else if (exp.start > weeks) soon.push(exp)
    else tryNow.push(exp)
  }
  soon.sort((a, b) => a.start - b.start)
  logged.sort((a, b) => (byExp[b.id].latestTs - byExp[a.id].latestTs))

  const ageStr = weeks < 13
    ? `${Math.floor(weeks)} weeks old`
    : `${Math.floor(weeks / 4.345)} months old`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Develop · {ageStr}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Playful things to try, matched to typical age ranges. Ranges are general and vary a lot — this isn't a test or medical guidance. Share any worries with your pediatrician.
        </p>
      </div>

      <Section title="Try now" subtitle="Windows open at this age" experiments={tryNow} byExp={byExp} onLog={onLog} emptyText="Nothing active right now — check Coming soon." />
      <Section title="Logged" subtitle="What you've tried" experiments={logged} byExp={byExp} onLog={onLog} emptyText="Nothing logged yet — try one above." />
      <Section title="Coming soon" subtitle="Windows opening later" experiments={soon} byExp={byExp} onLog={onLog} upcoming weeks={weeks} emptyText={null} />
    </div>
  )
}

function Section({ title, subtitle, experiments, byExp, onLog, emptyText, upcoming, weeks }) {
  if (experiments.length === 0 && emptyText == null) return null
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</p>
      </div>
      {experiments.length === 0 ? (
        <p className="text-xs text-gray-300 dark:text-gray-600">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {experiments.map(exp => (
            <ExperimentCard key={exp.id} exp={exp} state={byExp[exp.id]} onLog={onLog} upcoming={upcoming} weeks={weeks} />
          ))}
        </div>
      )}
    </section>
  )
}

function ExperimentCard({ exp, state, onLog, upcoming, weeks }) {
  const [open, setOpen] = useState(false)
  const dom = DOMAINS[exp.domain]
  const latest = state?.latest
  const latestR = latest ? RESULT_BY_KEY[latest] : null

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${
      latest === 'observed'
        ? 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30'
        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
    }`}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left">
        <div className="flex items-center gap-2">
          <span>{dom.icon}</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{exp.title}</span>
          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">{weeksLabel(exp.start, exp.end)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{dom.label}</span>
          {latestR && <span className={`text-[10px] font-semibold ${latestR.dim}`}>· {latestR.label}{state.observedTs ? ` ${new Date(state.observedTs).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}</span>}
          {upcoming && <span className="text-[10px] text-gray-400 dark:text-gray-500">· opens in {Math.max(1, Math.ceil(exp.start - weeks))} wk</span>}
        </div>
      </button>

      {(open || !upcoming) && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-xs text-gray-600 dark:text-gray-300"><span className="font-medium">Try:</span> {exp.how}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-medium">Look for:</span> {exp.look_for}</p>
          <div className="mt-1 flex gap-1.5">
            {RESULTS.map(r => (
              <button
                key={r.key}
                onClick={() => onLog(exp, r.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  latest === r.key ? r.cls : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
