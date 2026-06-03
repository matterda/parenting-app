import { useState } from 'react'
import { toLocalISO } from '../utils/time'
import EditEntry from './EditEntry'

// One-tap buttons that bypass the LLM. Tapping opens a draft editor at the
// current time; nothing is written to the DB until "Save" is pressed.
const BUTTONS = [
  { key: 'diaper',  label: '🧷 Diaper',  type: 'diaper',  color: 'bg-yellow-500 hover:bg-yellow-600' },
  { key: 'feed',    label: '🍼 Feed',    type: 'feed',    color: 'bg-blue-500 hover:bg-blue-600' },
  { key: 'pumping', label: '🤱 Pumping', type: 'pumping', color: 'bg-rose-500 hover:bg-rose-600' },
]

const TYPE_LABELS = { diaper: 'diaper', feed: 'feed', pumping: 'pumping' }

export default function QuickLog({ onCreate }) {
  const [draft, setDraft] = useState(null) // unsaved in-memory event

  function startDraft(btn) {
    setDraft({
      type: btn.type,
      timestamp_start: toLocalISO(new Date()),
      timestamp_end: null,
      data: {},
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
      extracted: true,
    })
  }

  // EditEntry returns a patch; merge it onto the draft and persist.
  async function handleSave(patch) {
    await onCreate({ ...draft, ...patch })
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {BUTTONS.map(btn => (
          <button
            key={btn.key}
            onClick={() => startDraft(btn)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${btn.color}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {draft && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 p-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            New {TYPE_LABELS[draft.type]} — fill in details, then Save
          </p>
          <EditEntry
            ev={draft}
            onSave={handleSave}
            onCancel={() => setDraft(null)}
          />
        </div>
      )}
    </div>
  )
}
