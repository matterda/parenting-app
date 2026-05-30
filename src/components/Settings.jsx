import { useState } from 'react'
import { getAllEvents } from '../db'
import { getTheme, applyTheme } from '../theme'

const KEY = 'anthropic_api_key'
const THEMES = ['system', 'light', 'dark']

export default function Settings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY) ?? '')
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState(getTheme)

  function saveKey() {
    localStorage.setItem(KEY, apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function chooseTheme(t) {
    setTheme(t)
    applyTheme(t)
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

  return (
    <div className="flex flex-col gap-5">
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

      <div className="flex flex-col gap-2">
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
    </div>
  )
}
