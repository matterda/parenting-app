import { useState, useRef, useEffect } from 'react'
import { askQuestion } from '../askData'

const SUGGESTIONS = [
  'How much did the baby sleep yesterday vs the day before?',
  'When was the last formula feed?',
  'How many wet diapers per day this week?',
  'Is breastfed volume trending up?',
]

export default function AskView({ events }) {
  const [turns, setTurns] = useState([]) // { q, a }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, busy])

  async function ask(question) {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setError('')
    setBusy(true)
    const history = turns.slice()
    try {
      const a = await askQuestion({ question: q, history, events })
      setTurns([...history, { q, a }])
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Ask about your data</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Questions about trends and history. Sends a summary of your logs to Anthropic. Not medical advice.
        </p>
      </div>

      {turns.length === 0 && !busy && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Try:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 px-3.5 py-2 text-sm text-white">
              {t.q}
            </div>
            <div className="self-start max-w-[90%] rounded-2xl rounded-bl-sm bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap shadow-sm">
              {t.a}
            </div>
          </div>
        ))}
        {busy && (
          <div className="self-start flex items-center gap-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 shadow-sm">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Thinking…</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 flex gap-2 bg-gray-50 dark:bg-gray-950 pt-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(input) }}
          placeholder="Ask a question…"
          className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          onClick={() => ask(input)}
          disabled={!input.trim() || busy}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40 transition"
        >
          Ask
        </button>
      </div>

      {turns.length > 0 && (
        <button onClick={() => setTurns([])} className="self-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          Clear conversation
        </button>
      )}
    </div>
  )
}
