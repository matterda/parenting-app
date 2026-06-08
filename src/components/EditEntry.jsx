import { useState } from 'react'
import { toLocalISO } from '../utils/time'

export default function EditEntry({ ev, onSave, onCancel }) {
  const [data, setData] = useState({ ...(ev.data ?? {}) })
  const [contextNote, setContextNote] = useState(ev.context_note ?? '')
  const [rawText, setRawText] = useState(ev.raw_text ?? '')
  const [timeStart, setTimeStart] = useState(toDateTimeInput(ev.timestamp_start))
  const [timeEnd, setTimeEnd] = useState(toDateTimeInput(ev.timestamp_end))

  function setField(key, val) {
    setData(prev => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    const patch = {}
    if (!ev.extracted) {
      patch.raw_text = rawText.trim()
    } else {
      patch.data = data
      patch.context_note = contextNote.trim() || null
      patch.timestamp_start = applyDateTimeInput(ev.timestamp_start, timeStart)
      if (ev.timestamp_end != null) {
        patch.timestamp_end = applyDateTimeInput(ev.timestamp_end, timeEnd)
      }
    }
    onSave(patch)
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
      {!ev.extracted ? (
        <Field label="Note">
          <textarea
            className={inputCls + ' resize-none'}
            rows={3}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          />
        </Field>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Field label="Date & time">
              <input type="datetime-local" className={inputCls} value={timeStart} onChange={e => setTimeStart(e.target.value)} />
            </Field>
            {ev.timestamp_end != null && (
              <Field label="End date & time">
                <input type="datetime-local" className={inputCls} value={timeEnd} onChange={e => setTimeEnd(e.target.value)} />
              </Field>
            )}
          </div>
          <TypeFields type={ev.type} data={data} setField={setField} />
          <Field label="Context note">
            <input
              type="text"
              className={inputCls}
              value={contextNote}
              placeholder="any qualitative detail"
              onChange={e => setContextNote(e.target.value)}
            />
          </Field>
        </>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">Save</button>
        <button onClick={onCancel} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
      </div>
    </div>
  )
}

function TypeFields({ type, data, setField }) {
  const num = (key, label, placeholder) => (
    <Field key={key} label={label}>
      <input type="number" className={inputCls} value={data[key] ?? ''} placeholder={placeholder}
        onChange={e => setField(key, e.target.value === '' ? null : Number(e.target.value))} />
    </Field>
  )
  const txt = (key, label, placeholder) => (
    <Field key={key} label={label}>
      <input type="text" className={inputCls} value={data[key] ?? ''} placeholder={placeholder}
        onChange={e => setField(key, e.target.value || null)} />
    </Field>
  )
  const sel = (key, label, options) => (
    <Field key={key} label={label}>
      <select className={inputCls} value={data[key] ?? ''} onChange={e => setField(key, e.target.value || null)}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  )

  switch (type) {
    case 'feed': return <div className="flex flex-wrap gap-3">
      {sel('method', 'Method', ['breast', 'bottle'])}
      {sel('milk_type', 'Milk type', ['breast_milk', 'formula'])}
      {num('volume_ml', 'Volume (ml)', '120')}
      {num('duration_min', 'Duration (min)', '15')}
      {sel('side', 'Side', ['L', 'R', 'both'])}
    </div>
    case 'pumping': return <div className="flex flex-wrap gap-3">
      {num('volume_ml', 'Volume (ml)', '90')}
      {num('duration_min', 'Duration (min)', '15')}
      {sel('side', 'Side', ['L', 'R', 'both'])}
    </div>
    case 'diaper': return <div className="flex flex-wrap gap-3">
      {sel('kind', 'Type', ['wet', 'dirty', 'both'])}
    </div>
    case 'weight': return <div className="flex flex-wrap gap-3">
      {num('value', 'Value', '3.5')}
      {sel('unit', 'Unit', ['kg', 'g', 'lb', 'oz'])}
    </div>
    case 'weighin': return <div className="flex flex-wrap gap-3">
      {num('value', 'Weight (clothed)', '6.42')}
      {sel('unit', 'Unit', ['kg', 'g', 'lb', 'oz'])}
    </div>
    case 'temperature': return <div className="flex flex-wrap gap-3">
      {num('value', 'Value', '37.0')}
      {sel('unit', 'Unit', ['C', 'F'])}
    </div>
    case 'medication': return <div className="flex flex-wrap gap-3">
      {txt('name', 'Name', 'Paracetamol')}
      {txt('dose', 'Dose', '2.5ml')}
    </div>
    case 'milestone': return <div className="flex flex-wrap gap-3">
      {txt('label', 'Label', 'first smile')}
    </div>
    case 'reminder': return <div className="flex flex-wrap gap-3">
      {txt('text', 'Reminder', 'e.g. book vaccination')}
    </div>
    default: return null
  }
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400'

// Local-time value for <input type="datetime-local"> (YYYY-MM-DDTHH:MM).
function toDateTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function applyDateTimeInput(existingISO, val) {
  if (!val) return existingISO
  try {
    const d = new Date(val) // parsed as local time
    if (isNaN(d.getTime())) return existingISO
    return toLocalISO(d)
  } catch { return existingISO }
}
