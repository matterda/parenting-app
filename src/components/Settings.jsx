import { useState } from 'react'
import { getAllEvents } from '../db'

const KEY = 'anthropic_api_key'

export default function Settings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY) ?? '')
  const [saved, setSaved] = useState(false)

  function saveKey() {
    localStorage.setItem(KEY, apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
        <label className="text-sm font-medium text-gray-700">Anthropic API key</label>
        <input
          type="password"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
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
        <p className="text-xs text-gray-400">
          Stored only in this browser's localStorage. Never sent anywhere except the Anthropic API.
        </p>
      </div>

      <hr className="border-gray-100" />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Data backup</p>
        <button
          onClick={exportJSON}
          className="self-start rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
        >
          Export all data as JSON
        </button>
        <p className="text-xs text-gray-400">
          All data lives in this browser only. Export regularly as your backup.
        </p>
      </div>
    </div>
  )
}
