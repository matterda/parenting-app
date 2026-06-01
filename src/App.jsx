import { useState, useEffect } from 'react'
import { addRawEvent, replaceWithExtracted, getAllEvents, deleteEvent, updateEvent, upsertEvent } from './db'
import { extractEvents } from './api'
import { scheduleCheck } from './notifications'
import { syncPull, syncPush, syncDelete } from './sync'
import { saveSnapshot } from './utils/snapshots'
import { lastOfType } from './utils/aggregate'
import LogInput from './components/LogInput'
import EventList from './components/EventList'
import EchoLoop from './components/EchoLoop'
import TrendView from './components/TrendView'
import Settings from './components/Settings'
import ActiveSleepBanner, { LastSleepBanner } from './components/ActiveSleepBanner'

const TABS = ['Log', 'History', 'Trends', 'Settings']

function getActiveSleep(events) {
  return events.find(e => e.extracted && e.type === 'sleep' && !e.timestamp_end) ?? null
}

export default function App() {
  const [tab, setTab] = useState('Log')
  const [events, setEvents] = useState([])

  // Extraction state
  const [phase, setPhase] = useState('idle') // 'idle' | 'extracting' | 'confirming' | 'error'
  const [extracted, setExtracted] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const [pendingText, setPendingText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [prefilledText, setPrefilledText] = useState('')

  useEffect(() => {
    async function init() {
      const { events: remoteEvs, tombstoneIds } = await syncPull()
      for (const ev of remoteEvs) await upsertEvent(ev)
      for (const id of tombstoneIds) await deleteEvent(id).catch(() => {})
      const evs = await getAllEvents()
      setEvents(evs)
      scheduleCheck(evs)
      saveSnapshot(evs)
    }
    init()
  }, [])

  // Pull remote + re-schedule when returning to the app
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      const { events: remoteEvs, tombstoneIds } = await syncPull()
      let changed = tombstoneIds.length > 0 || remoteEvs.length > 0
      for (const ev of remoteEvs) await upsertEvent(ev)
      for (const id of tombstoneIds) await deleteEvent(id).catch(() => {})
      if (changed) {
        await refreshEvents()
      } else {
        scheduleCheck(events)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [events])

  const activeSleep = getActiveSleep(events)

  async function handleAdd(rawText) {
    setPendingText(rawText)
    setPhase('extracting')

    const placeholder = await addRawEvent(rawText)
    setPendingId(placeholder.id)

    try {
      const result = await extractEvents(rawText, activeSleep?.timestamp_start ?? null)
      setExtracted(result)
      setPhase('confirming')
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
      await refreshEvents()
    }
  }

  async function handleConfirm(confirmedEvents) {
    if (activeSleep) {
      const closer = confirmedEvents.find(e => e.closes_active_sleep && e.type === 'sleep')
      if (closer) {
        await updateEvent(activeSleep.id, { timestamp_end: closer.timestamp_end })
        const remaining = confirmedEvents.filter(e => e !== closer)
        if (remaining.length > 0) {
          await replaceWithExtracted(pendingId, remaining)
        } else {
          await deleteEvent(pendingId)
        }
        await refreshEvents()
        reset()
        setTab('History')
        return
      }
    }

    await replaceWithExtracted(pendingId, confirmedEvents)
    await refreshEvents()
    reset()
    setTab('History')
  }

  function handleReject() {
    const text = pendingText
    reset()
    setPrefilledText(text)
    setTab('Log')
  }

  async function handleMarkAwake() {
    if (!activeSleep) return
    await updateEvent(activeSleep.id, { timestamp_end: new Date().toISOString() })
    await refreshEvents()
  }

  function reset() {
    setPhase('idle')
    setExtracted(null)
    setPendingId(null)
    setPendingText('')
    setErrorMsg('')
  }

  async function handleDelete(id) {
    await deleteEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    syncDelete(id)
    // Save snapshot after deletion so we can recover it
    const all = await getAllEvents()
    saveSnapshot(all)
    syncPush(all)
  }

  async function handleEdit(id, patch) {
    await updateEvent(id, patch)
    await refreshEvents()
  }

  async function refreshEvents() {
    const all = await getAllEvents()
    setEvents(all)
    scheduleCheck(all)
    saveSnapshot(all)
    syncPush(all)
  }

  async function handleRestore() {
    await refreshEvents()
    setTab('History')
  }

  return (
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

      <main className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full">

        {phase === 'extracting' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Extracting events…</p>
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
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
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
            {activeSleep && (
              <ActiveSleepBanner
                since={activeSleep.timestamp_start}
                onMarkAwake={handleMarkAwake}
              />
            )}
            {!activeSleep && (() => {
              const lastSleep = lastOfType(events, 'sleep')
              return lastSleep?.timestamp_end
                ? <LastSleepBanner lastSleep={lastSleep} />
                : null
            })()}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Describe what happened in plain language. Tap the mic on your keyboard to dictate.
            </p>
            <LogInput key={prefilledText} defaultValue={prefilledText} onAdd={handleAdd} />
          </section>
        )}

        {phase === 'idle' && tab === 'History' && (
          <EventList events={events} onDelete={handleDelete} onEdit={handleEdit} />
        )}

        {phase === 'idle' && tab === 'Trends' && (
          <TrendView events={events} />
        )}

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
