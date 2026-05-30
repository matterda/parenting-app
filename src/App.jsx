import { useState, useEffect } from 'react'
import { addEvent, getAllEvents } from './db'
import LogInput from './components/LogInput'
import EventList from './components/EventList'
import Settings from './components/Settings'

const TABS = ['Log', 'History', 'Settings']

export default function App() {
  const [tab, setTab] = useState('Log')
  const [events, setEvents] = useState([])

  useEffect(() => {
    getAllEvents().then(setEvents)
  }, [])

  async function handleAdd(rawText) {
    const record = await addEvent(rawText)
    setEvents(prev => [record, ...prev])
    setTab('History')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-violet-600 px-4 pt-safe pb-3 shadow-md">
        <h1 className="text-lg font-bold text-white tracking-tight">Baby Log</h1>
      </header>

      {/* Tab bar */}
      <nav className="flex border-b border-gray-200 bg-white">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t
                ? 'border-b-2 border-violet-600 text-violet-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full">
        {tab === 'Log' && (
          <section className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Describe what happened in plain language. Tap the mic on your keyboard to dictate.
            </p>
            <LogInput onAdd={handleAdd} />
          </section>
        )}

        {tab === 'History' && (
          <section>
            <EventList events={events} />
          </section>
        )}

        {tab === 'Settings' && (
          <section>
            <Settings />
          </section>
        )}
      </main>
    </div>
  )
}
