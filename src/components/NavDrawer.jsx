import { MENU_TABS } from '../App'

export default function NavDrawer({ open, tab, onSelect, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-64 max-w-[80%] bg-white dark:bg-gray-900 shadow-xl pt-safe flex flex-col">
        <div className="px-4 py-4 text-sm font-semibold text-gray-400 dark:text-gray-500">More</div>
        <nav className="flex flex-col">
          {MENU_TABS.map(t => (
            <button
              key={t}
              onClick={() => { onSelect(t); onClose() }}
              className={`text-left px-4 py-3 text-sm font-medium transition ${
                tab === t
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
