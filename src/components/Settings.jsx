import { useState } from 'react'
import { getAllEvents, clearAllEvents, upsertEvent, addImportedEvents } from '../db'
import { parseEventsCsv, CSV_TEMPLATE } from '../utils/importCsv'
import { getTheme, applyTheme } from '../theme'
import { getNotifSettings, saveNotifSettings, requestPermission } from '../notifications'
import { listSnapshots, getSnapshotData, listDailySnapshots, getDailySnapshotData } from '../utils/snapshots'
import {
  listRestorePoints,
  reconstructAt,
  stateBeforeLastN,
  exportLog,
  getLogCount,
} from '../utils/eventLog'

const KEY = 'anthropic_api_key'
const SYNC_KEY = 'firebase_sync_url'
const MODEL_KEY = 'anthropic_model'
const BABY_NAME_KEY = 'baby_name'
const BABY_DOB_KEY = 'baby_dob'
const THEMES = ['system', 'light', 'dark']
const DELAY_OPTIONS = [1, 2, 3, 4]
const FILTER_OPTIONS = [
  { value: 'any', label: 'Any feed' },
  { value: 'bottle', label: 'Bottle only' },
  { value: 'breast', label: 'Breast only' },
  { value: 'formula', label: 'Formula only' },
]
const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (default)' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 (faster / cheaper)' },
]

export default function Settings({ onNotifSettingsChanged, onRestore }) {
  const [babyName, setBabyName] = useState(() => localStorage.getItem(BABY_NAME_KEY) ?? '')
  const [babyDob, setBabyDob] = useState(() => localStorage.getItem(BABY_DOB_KEY) ?? '')
  const [babySaved, setBabySaved] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY) ?? '')
  const [saved, setSaved] = useState(false)
  const [syncUrl, setSyncUrl] = useState(() => localStorage.getItem(SYNC_KEY) ?? '')
  const [syncSaved, setSyncSaved] = useState(false)
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) || 'claude-sonnet-4-6')
  const [theme, setTheme] = useState(getTheme)
  const [notif, setNotif] = useState(getNotifSettings)
  const [permState, setPermState] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const [snapshots, setSnapshots] = useState(listSnapshots)
  const [dailySnapshots, setDailySnapshots] = useState(listDailySnapshots)
  const [restoringDaily, setRestoringDaily] = useState(null)
  const [restoring, setRestoring] = useState(null)

  // Operation-log recovery
  const [logOpen, setLogOpen] = useState(false)
  const [logPoints, setLogPoints] = useState([])
  const [logCount, setLogCount] = useState(null)
  const [logBusy, setLogBusy] = useState(false)
  const [undoN, setUndoN] = useState(1)

  // CSV import
  const [csvText, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState(null) // { events, errors }
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvDone, setCsvDone] = useState(null)

  function saveBaby() {
    localStorage.setItem(BABY_NAME_KEY, babyName.trim())
    localStorage.setItem(BABY_DOB_KEY, babyDob)
    setBabySaved(true)
    setTimeout(() => setBabySaved(false), 2000)
  }

  function saveKey() {
    localStorage.setItem(KEY, apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function saveSyncUrl() {
    localStorage.setItem(SYNC_KEY, syncUrl.trim())
    setSyncSaved(true)
    setTimeout(() => setSyncSaved(false), 2000)
  }

  function chooseModel(m) {
    setModel(m)
    localStorage.setItem(MODEL_KEY, m)
  }

  function chooseTheme(t) {
    setTheme(t)
    applyTheme(t)
  }

  async function toggleNotif() {
    if (!notif.enabled && permState !== 'granted') {
      const result = await requestPermission()
      setPermState(result)
      if (result !== 'granted') return
    }
    const next = { ...notif, enabled: !notif.enabled }
    setNotif(next)
    saveNotifSettings(next)
    onNotifSettingsChanged?.(next)
  }

  function updateNotif(patch) {
    const next = { ...notif, ...patch }
    setNotif(next)
    saveNotifSettings(next)
    onNotifSettingsChanged?.(next)
  }

  async function exportJSON() {
    const events = await getAllEvents()
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baby-log-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRestore(index) {
    if (restoring != null) return
    if (!window.confirm('Restore this snapshot? Current data will be replaced.')) return
    setRestoring(index)
    const data = getSnapshotData(index)
    await clearAllEvents()
    for (const ev of data) await upsertEvent(ev)
    onRestore?.()
    setRestoring(null)
    setSnapshots(listSnapshots())
  }

  async function handleRestoreDaily(index) {
    if (restoringDaily != null) return
    if (!window.confirm('Restore this daily backup? Current data will be replaced.')) return
    setRestoringDaily(index)
    const data = await getDailySnapshotData(index)
    await clearAllEvents()
    for (const ev of data) await upsertEvent(ev)
    onRestore?.()
    setRestoringDaily(null)
    setDailySnapshots(listDailySnapshots())
  }

  // ── Operation-log recovery ──────────────────────────────────────────────
  async function toggleLog() {
    const next = !logOpen
    setLogOpen(next)
    if (next) {
      const [points, count] = await Promise.all([listRestorePoints(), getLogCount()])
      setLogPoints(points)
      setLogCount(count)
    }
  }

  // Replace all live events with the given reconstructed set.
  async function applyState(events) {
    await clearAllEvents()
    for (const ev of events) await upsertEvent(ev)
    onRestore?.()
    setSnapshots(listSnapshots())
    const [points, count] = await Promise.all([listRestorePoints(), getLogCount()])
    setLogPoints(points)
    setLogCount(count)
  }

  async function handleTimeTravel(seq) {
    if (logBusy) return
    if (!window.confirm(`Restore data to its state at this point (seq ${seq})? Current data will be replaced.`)) return
    setLogBusy(true)
    try {
      const events = await reconstructAt(seq)
      await applyState(events)
    } finally {
      setLogBusy(false)
    }
  }

  async function handleUndo() {
    if (logBusy) return
    if (!window.confirm(`Undo the last ${undoN} operation${undoN > 1 ? 's' : ''}? Current data will be replaced.`)) return
    setLogBusy(true)
    try {
      const events = await stateBeforeLastN(undoN)
      await applyState(events)
    } finally {
      setLogBusy(false)
    }
  }

  // ── CSV import ──────────────────────────────────────────────────────────
  function previewCsv(text) {
    setCsvText(text)
    setCsvDone(null)
    setCsvPreview(text.trim() ? parseEventsCsv(text) : null)
  }

  async function handleCsvFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    previewCsv(text)
    e.target.value = '' // allow re-picking the same file
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'baby-log-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doCsvImport() {
    if (!csvPreview || csvPreview.events.length === 0 || csvImporting) return
    if (!window.confirm(`Import ${csvPreview.events.length} event${csvPreview.events.length > 1 ? 's' : ''}? They'll be added to your existing log.`)) return
    setCsvImporting(true)
    try {
      await addImportedEvents(csvPreview.events)
      setCsvDone(csvPreview.events.length)
      setCsvText('')
      setCsvPreview(null)
      onRestore?.()
      setSnapshots(listSnapshots())
    } finally {
      setCsvImporting(false)
    }
  }

  async function exportHistory() {
    const json = await exportLog()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baby-log-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Baby info */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Baby</p>
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">Name</label>
            <input
              type="text"
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="e.g. Sofia"
              value={babyName}
              onChange={e => setBabyName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">Date of birth</label>
            <input
              type="date"
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={babyDob}
              onChange={e => setBabyDob(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={saveBaby}
          className="self-start rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition"
        >
          {babySaved ? 'Saved ✓' : 'Save'}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Used in the extraction prompt and the pediatrician report.
        </p>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* API key */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Anthropic API key</label>
        <input
          type="password"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
        <button
          onClick={saveKey}
          className="self-start rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition"
        >
          {saved ? 'Saved ✓' : 'Save key'}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Stored only in this browser's localStorage. Never sent anywhere except the Anthropic API.
        </p>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Model */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Extraction model</p>
        <div className="flex flex-col gap-1.5">
          {MODELS.map(m => (
            <label key={m.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="model"
                value={m.value}
                checked={model === m.value}
                onChange={() => chooseModel(m.value)}
                className="accent-violet-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">{m.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Haiku is ~10× cheaper and faster; Sonnet understands ambiguous notes better.
        </p>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Firebase */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Firebase sync URL</label>
        <input
          type="url"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          placeholder="https://your-app-default-rtdb.firebaseio.com"
          value={syncUrl}
          onChange={e => setSyncUrl(e.target.value)}
        />
        <button
          onClick={saveSyncUrl}
          className="self-start rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition"
        >
          {syncSaved ? 'Saved ✓' : 'Save URL'}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Paste the same URL on both devices to share a live database. Leave empty for local-only mode.
        </p>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Appearance */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Appearance</p>
        <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 p-1 self-start">
          {THEMES.map(t => (
            <button
              key={t}
              onClick={() => chooseTheme(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${
                theme === t
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Feed reminder */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Feed reminder</p>

        {permState === 'unsupported' && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Notifications are not supported in this browser.</p>
        )}
        {permState === 'denied' && (
          <p className="text-xs text-red-500">Notification permission was denied. Enable it in your browser/OS settings.</p>
        )}

        {permState !== 'unsupported' && (
          <>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={toggleNotif}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notif.enabled ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  notif.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-200">Remind me to feed</span>
            </label>

            {notif.enabled && (
              <div className="flex flex-col gap-3 pl-1">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Remind after</p>
                  <div className="flex gap-2">
                    {DELAY_OPTIONS.map(h => (
                      <button key={h} onClick={() => updateNotif({ delayHours: h })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          notif.delayHours === h
                            ? 'bg-violet-600 text-white'
                            : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}>{h}h</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Feed type to watch</p>
                  <div className="flex gap-2 flex-wrap">
                    {FILTER_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => updateNotif({ feedFilter: o.value })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          notif.feedFilter === o.value
                            ? 'bg-violet-600 text-white'
                            : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">Only fires while the app is open. No push server involved.</p>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Data backup */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Data backup</p>
        <button
          onClick={exportJSON}
          className="self-start rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Export all data as JSON
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          All data lives in this browser only. Export regularly as your backup.
        </p>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* CSV import */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Import from CSV</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          For bulk-adding historical records. One row per event. Columns:
          {' '}<code className="text-[11px]">type, start, end, method, milk_type, side, volume_ml, duration_min, kind, value, unit, name, dose, label, note</code>.
          Times are local, e.g. <code className="text-[11px]">2026-05-01 14:30</code>. Leave unused columns blank.
        </p>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Download template
          </button>
          <label className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
          </label>
        </div>

        <textarea
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-xs font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
          rows={4}
          placeholder="…or paste CSV here"
          value={csvText}
          onChange={e => previewCsv(e.target.value)}
        />

        {csvPreview && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {csvPreview.events.length} valid event{csvPreview.events.length === 1 ? '' : 's'} ready to import
              {csvPreview.errors.length > 0 && `, ${csvPreview.errors.length} row${csvPreview.errors.length === 1 ? '' : 's'} skipped`}.
            </p>
            {csvPreview.errors.length > 0 && (
              <ul className="flex flex-col gap-0.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-2 max-h-40 overflow-y-auto">
                {csvPreview.errors.map((err, i) => (
                  <li key={i} className="text-[11px] text-red-600 dark:text-red-400">{err}</li>
                ))}
              </ul>
            )}
            <button
              onClick={doCsvImport}
              disabled={csvPreview.events.length === 0 || csvImporting}
              className="self-start rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40 transition"
            >
              {csvImporting ? 'Importing…' : `Import ${csvPreview.events.length} event${csvPreview.events.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}

        {csvDone != null && (
          <p className="text-xs text-green-600 dark:text-green-400">Imported {csvDone} event{csvDone === 1 ? '' : 's'} ✓</p>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Local snapshots */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Local snapshots</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          The app automatically saves the last 10 snapshots here whenever you log something. Tap Restore to roll back to any of them — protects against accidental deletions or Firebase issues.
        </p>
        {snapshots.length === 0 ? (
          <p className="text-xs text-gray-300 dark:text-gray-600">No snapshots yet — log something first.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshots.map(s => (
              <li key={s.index} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 shadow-sm">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {new Date(s.savedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{s.count} entries</p>
                </div>
                <button
                  onClick={() => handleRestore(s.index)}
                  disabled={restoring != null}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition"
                >
                  {restoring === s.index ? 'Restoring…' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Daily backups */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Daily backups</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Once per day the app saves a compressed snapshot on this device, keeping the last 30 days. A longer-horizon safety net than the rolling snapshots above.
        </p>
        {dailySnapshots.length === 0 ? (
          <p className="text-xs text-gray-300 dark:text-gray-600">No daily backups yet — they start after your first launch.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dailySnapshots.map(s => (
              <li key={s.index} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 shadow-sm">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {new Date(s.day + 'T00:00:00').toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{s.count} entries</p>
                </div>
                <button
                  onClick={() => handleRestoreDaily(s.index)}
                  disabled={restoringDaily != null}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition"
                >
                  {restoringDaily === s.index ? 'Restoring…' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Operation history & recovery */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Operation history &amp; recovery</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Every create, edit and delete is recorded in a local, append-only log that survives remote
          database wipes. Use it to undo recent changes, roll back to any earlier point, or export the
          full history for offsite backup.
        </p>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportHistory}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Export full history
          </button>
          <button
            onClick={toggleLog}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {logOpen ? 'Hide audit log' : 'Inspect audit log'}
          </button>
        </div>

        {/* Undo last N */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500">Undo last</span>
          <input
            type="number"
            min="1"
            value={undoN}
            onChange={e => setUndoN(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">operation{undoN > 1 ? 's' : ''}</span>
          <button
            onClick={handleUndo}
            disabled={logBusy}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40 transition"
          >
            {logBusy ? 'Working…' : 'Undo'}
          </button>
        </div>

        {logOpen && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {logCount ?? 0} total operations. Tap a row to roll back to that point in time.
            </p>
            {logPoints.length === 0 ? (
              <p className="text-xs text-gray-300 dark:text-gray-600">No operations logged yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                {logPoints.map(p => (
                  <li key={p.seq}>
                    <button
                      onClick={() => handleTimeTravel(p.seq)}
                      disabled={logBusy}
                      className="w-full flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-left shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-200">
                          <span className={`font-mono uppercase ${
                            p.op === 'delete' ? 'text-red-500'
                              : p.op === 'create' ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>{p.op}</span>
                          {' '}
                          <span className="text-gray-400 dark:text-gray-500">
                            {p.source === 'sync' ? 'sync' : 'you'}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {new Date(p.ts).toLocaleString()} · {p.count} entries
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-300 dark:text-gray-600 shrink-0 ml-2">
                        #{p.seq}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Version */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Version</p>
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>App version</span>
          <span className="font-mono text-gray-600 dark:text-gray-300">
            {APP_VERSION} · {GIT_COMMIT}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>Last updated</span>
          <span className="text-gray-600 dark:text-gray-300">{BUILD_DATE}</span>
        </div>
      </div>

    </div>
  )
}

// Build-time constants injected by Vite (see vite.config.js `define`).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const GIT_COMMIT  = typeof __GIT_COMMIT__  !== 'undefined' ? __GIT_COMMIT__  : 'local'
const BUILD_DATE  = (() => {
  try {
    const iso = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null
    return iso ? new Date(iso).toLocaleString() : '—'
  } catch { return '—' }
})()
