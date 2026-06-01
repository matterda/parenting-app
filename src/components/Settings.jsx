import { useState } from 'react'
import { getAllEvents, clearAllEvents, upsertEvent } from '../db'
import { getTheme, applyTheme } from '../theme'
import { getNotifSettings, saveNotifSettings, requestPermission } from '../notifications'
import { listSnapshots, getSnapshotData } from '../utils/snapshots'

const KEY = 'anthropic_api_key'
const SYNC_KEY = 'firebase_sync_url'
const MODEL_KEY = 'anthropic_model'
const THEMES = ['system', 'light', 'dark']
const DELAY_OPTIONS = [1, 2, 3, 4]
const FILTER_OPTIONS = [
  { value: 'any', label: 'Any feed' },
  { value: 'breast', label: 'Breast only' },
  { value: 'formula', label: 'Formula only' },
]
const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (default)' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 (faster / cheaper)' },
]

export default function Settings({ onNotifSettingsChanged, onRestore }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY) ?? '')
  const [saved, setSaved] = useState(false)
  const [syncUrl, setSyncUrl] = useState(() => localStorage.getItem(SYNC_KEY) ?? '')
  const [syncSaved, setSyncSaved] = useState(false)
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) || 'claude-sonnet-4-6')
  const [theme, setTheme] = useState(getTheme)
  const [notif, setNotif] = useState(getNotifSettings)
  const [permState, setPermState] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const [snapshots, setSnapshots] = useState(listSnapshots)
  const [restoring, setRestoring] = useState(null)

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

  return (
    <div className="flex flex-col gap-5">

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

    </div>
  )
}
