import { useState, useEffect, useRef, useCallback } from 'react'
import { addRawEvent, replaceWithExtracted, getAllEvents, deleteEvent, updateEvent, upsertEvent, addImportedEvents } from './db'
import { extractEvents } from './api'
import { toLocalISO } from './utils/time'
import { scheduleCheck } from './notifications'
import { syncPull, syncPush, syncDelete, syncServerTime } from './sync'
import { saveSnapshot, saveDailySnapshot } from './utils/snapshots'
import { lastOfType } from './utils/aggregate'
import LogInput from './components/LogInput'
import EventList from './components/EventList'
import EchoLoop from './components/EchoLoop'
import TrendView from './components/TrendView'
import Settings from './components/Settings'
import ActiveSleepBanner, { LastSleepBanner } from './components/ActiveSleepBanner'
import FeedOverdueBanner from './components/FeedOverdueBanner'
import OutstandingLogs from './components/OutstandingLogs'
import QuickLog from './components/QuickLog'
import WeighInCard from './components/WeighInCard'
import Reminders from './components/Reminders'
import { computeWeighEstimate } from './utils/weighFeed'
import ReportView from './components/ReportView'

const TABS = ['Log', 'History', 'Trends', 'Report', 'Settings']

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
      await syncServerTime()
      const { events: remoteEvs, tombstoneIds } = await syncPull()
      for (const ev of remoteEvs) await upsertEvent(ev)
      for (const id of tombstoneIds) await deleteEvent(id).catch(() => {})
      const evs = await getAllEvents()
      setEvents(evs)
      scheduleCheck(evs)
      saveSnapshot(evs)
      saveDailySnapshot(evs)
    }
    init()
  }, [])

  // Pull remote + re-schedule when returning to the app
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      await syncServerTime()
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

  // ── swipe to change tab ──────────────────────────────────────────────────
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const handleTouchStart = useCallback(e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(e => {
    if (touchStartX.current === null || phase !== 'idle') return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Ignore if mostly vertical (scrolling)
    if (Math.abs(dy) > Math.abs(dx)) return
    // Require at least 60px horizontal swipe
    if (Math.abs(dx) < 60) return
    const idx = TABS.indexOf(tab)
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1])
    if (dx > 0 && idx > 0)               setTab(TABS[idx - 1])
  }, [phase, tab])

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

  // Retry extraction on an existing raw entry from History. Reuses the raw
  // record as the placeholder, so confirming replaces it with structured events.
  async function handleRetryRaw(ev) {
    if (!ev.raw_text) return
    setPendingId(ev.id)
    setPendingText(ev.raw_text)
    setPhase('extracting')
    setTab('Log')
    try {
      const result = await extractEvents(ev.raw_text, activeSleep?.timestamp_start ?? null)
      setExtracted(result)
      setPhase('confirming')
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
    }
  }

  // Re-run extraction with edited note text (keeps same placeholder ID)
  async function handleReextract(newText) {
    setPendingText(newText)
    setPhase('extracting')
    try {
      const result = await extractEvents(newText, activeSleep?.timestamp_start ?? null)
      setExtracted(result)
      setPhase('confirming')
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
    }
  }

  // Delete the pending placeholder and return to Log tab cleanly
  async function handleDeletePending() {
    await deleteEvent(pendingId)
    syncDelete(pendingId)
    reset()
    setTab('Log')
  }

  async function handleMarkAwake() {
    if (!activeSleep) return
    await updateEvent(activeSleep.id, { timestamp_end: new Date().toISOString() })
    await refreshEvents()
  }

  async function handleStartSleep() {
    if (activeSleep) return
    await addImportedEvents([{
      type: 'sleep',
      timestamp_start: toLocalISO(new Date()),
      timestamp_end: null,
      data: {},
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
    }])
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

  // Non-LLM create path used by the day-timeline editor: insert one structured
  // event at a chosen time, then return it so the timeline can open its editor.
  async function handleCreate(ev) {
    const [saved] = await addImportedEvents([ev])
    await refreshEvents()
    return saved
  }

  // Record a clothed weigh-in, then estimate the volume of any breastfeed(s)
  // since the last valid baseline and auto-write it onto those feeds.
  async function handleWeighIn({ value, unit }) {
    const [saved] = await addImportedEvents([{
      type: 'weighin',
      timestamp_start: toLocalISO(new Date()),
      timestamp_end: null,
      data: { value, unit, clothed: true },
      context_note: null,
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
    }])

    const all = await getAllEvents()
    const result = computeWeighEstimate(all, saved)

    if (result.status === 'ok' && result.deltaG > 0) {
      for (const f of result.feeds) {
        if (f.volume_ml == null) continue
        const feed = all.find(e => e.id === f.id)
        await updateEvent(f.id, {
          data: {
            ...(feed?.data ?? {}),
            volume_ml: f.volume_ml,
            volume_source: 'weighed',
            volume_estimated: true,
            volume_split: f.split,
            weighin_before_id: result.baselineId,
            weighin_after_id: saved.id,
          },
        })
      }
      await updateEvent(saved.id, {
        data: { value, unit, clothed: true, delta_g: Math.round(result.deltaG), paired_id: result.baselineId, feed_ids: result.feeds.map(f => f.id) },
      })
    } else if (result.status === 'no_feed' || result.status === 'invalid') {
      // Keep the raw delta on the record where one exists, for later analysis.
      if (result.deltaG != null) {
        await updateEvent(saved.id, { data: { value, unit, clothed: true, delta_g: Math.round(result.deltaG), paired_id: result.baselineId ?? null } })
      }
    }

    await refreshEvents()
    return result
  }

  async function refreshEvents() {
    const all = await getAllEvents()
    setEvents(all)
    scheduleCheck(all)
    saveSnapshot(all)
    saveDailySnapshot(all)
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

      <main
        className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {phase === 'extracting' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Extracting events…</p>
          </div>
        )}

        {phase === 'confirming' && extracted && (
          <EchoLoop
            events={extracted.events}
            rawText={pendingText}
            adviceRequested={extracted.advice_requested}
            onConfirm={handleConfirm}
            onReextract={handleReextract}
            onDelete={handleDeletePending}
          />
        )}

        {phase === 'error' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
              <strong>Extraction failed:</strong> {errorMsg}
              <br />Your note was kept as a <strong>raw entry</strong> in History — open it there to retry extraction or edit it by hand. It won't be counted in trends until extracted.
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
              return (
                <LastSleepBanner
                  lastSleep={lastSleep?.timestamp_end ? lastSleep : null}
                  onStartSleep={handleStartSleep}
                />
              )
            })()}
            <FeedOverdueBanner events={events} />
            <QuickLog onCreate={handleCreate} />
            <WeighInCard events={events} onWeighIn={handleWeighIn} />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Or describe what happened in plain language. Tap the mic on your keyboard to dictate.
            </p>
            <LogInput key={prefilledText} defaultValue={prefilledText} onAdd={handleAdd} />
            <Reminders events={events} onCreate={handleCreate} onEdit={handleEdit} onDelete={handleDelete} />
            <OutstandingLogs events={events} onEdit={handleEdit} />
          </section>
        )}

        {phase === 'idle' && tab === 'History' && (
          <EventList events={events} onDelete={handleDelete} onEdit={handleEdit} onCreate={handleCreate} onRetryRaw={handleRetryRaw} />
        )}

        {phase === 'idle' && tab === 'Trends' && (
          <TrendView events={events} />
        )}

        {phase === 'idle' && tab === 'Report' && (
          <ReportView events={events} />
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
