import { useState } from 'react'

export default function LogInput({ onAdd, defaultValue = '' }) {
  const [text, setText] = useState(defaultValue)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setSaving(true)
    await onAdd(trimmed)
    setText('')
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        className="w-full rounded-xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-4 text-base leading-relaxed shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        rows={3}
        placeholder="e.g. fed 120ml bottle, a bit fussy, now sleeping"
        value={text}
        onChange={e => setText(e.target.value)}
        // On mobile, 'enter' adds a newline (natural for dictation); explicit submit button handles save
      />
      <button
        type="submit"
        disabled={saving || !text.trim()}
        className="self-end rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Log it'}
      </button>
    </form>
  )
}
