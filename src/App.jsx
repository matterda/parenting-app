import { useState, useEffect } from 'react'
import { addRawEvent, replaceWithExtracted, getAllEvents } from './db'
import { extractEvents } from './api'
import LogInput from './components/LogInput'
import EventList from './components/EventList'
import EchoLoop from './components/EchoLoop'
import Settings from './components/Settings'

const TABS = ['Log', 'History', 'Settings']

export default function App() {
  const [tab, setTab] = useState('Log')
  const [events, setEvents] = useState([])

  // Extraction state
  const [phase, setPhase] = useState('idle') // 'idle' | 'extracting' | 'confirming' | 'error'
  const [extracted, setExtracted] = useState(null) // { events, adviceRequested }
  const [pendingId, setPendingId] = useState(null) // placeholder record id
  const [pendingText, setPendingText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    getAllEvents().then(setEvents)
  }, [])

  async function handleAdd(rawText) {
    setPendingText(rawText)
    setPhase('extracting')

    // Save raw immediately — nothing lost if API fails
    const placeholder = await addRawEvent(rawText)
    setPendingId(placeholder.id)

    try {
      const result = await extractEvents(rawText)
      setExtracted(result)
      setPhase('confirming')
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
      // Keep the raw placeholder in DB; user can still see it in History
      await refreshEvents()
    }
  }

  async function handleConfirm(confirmedEvents) {
    const saved = await replaceWithExtracted(pendingId, confirmedEvents)
    await refreshEvents()
    reset()
    setTab('History')
  }

  function handleReject() {
    // Remove placeholder and send user back to Log with text pre-filled
    // (placeholder stays in DB as a safety net — user can delete from History later)
    reset()
    setTab('Log')
  }

  function reset() {
    setPhase('idle')
    setExtracted(null)
    setPendingId(null)
    setPendingText('')
    setErrorMsg('')
  }

  async function refreshEvents() {
    const all = await getAllEvents()
    setEvents(all)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-violet-600 px-4 pt-safe pb-3 shadow-md">
        <h1 className="text-lg font-bold text-white tracking-tight">Baby Log</h1>
      </header>

      <nav className="flex border-b border-gray-200 bg-white">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => { if (phase === 'idle') setTab(t) }}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t
                ? 'border-b-2 border-violet-600 text-violet-600'
                : 'text-gray-500 hover:text-gray-700'
            } ${phase !== 'idle' ? 'opacity-40 cursor-default' : ''}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full">

        {/* Extraction overlay — shown on top of Log tab */}
        {phase === 'extracting' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
            <p className="text-sm text-gray-500">Extracting events…</p>
          </div>
        )}

        {phase === 'confirming' && extracted && (
          <EchoLoop
            events={extracted.events}
            adviceRequested={extracted.advice_requested}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        )}

        {phase === 'error' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Extraction failed:</strong> {errorMsg}
              <br />Your note was saved as raw text.
            </div>
            <button
              onClick={reset}
              className="self-start rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
            >
              Back to log
            </button>
          </div>
        )}

        {phase === 'idle' && tab === 'Log' && (
          <section className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Describe what happened in plain language. Tap the mic on your keyboard to dictate.
            </p>
            <LogInput onAdd={handleAdd} />
          </section>
        )}

        {phase === 'idle' && tab === 'History' && (
          <EventList events={events} />
        )}

        {phase === 'idle' && tab === 'Settings' && (
          <Settings />
        )}
      </main>
    </div>
  )
}
