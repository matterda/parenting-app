import { PencilIcon, ListIcon, ChartIcon } from './icons'

const ITEMS = [
  { tab: 'Log', label: 'Log', Icon: PencilIcon },
  { tab: 'History', label: 'History', Icon: ListIcon },
  { tab: 'Trends', label: 'Trends', Icon: ChartIcon },
]

export default function BottomNav({ tab, onSelect, disabled }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pb-safe">
      {ITEMS.map(({ tab: t, label, Icon }) => (
        <button
          key={t}
          onClick={() => { if (!disabled) onSelect(t) }}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
            tab === t
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
          } ${disabled ? 'opacity-40 cursor-default' : ''}`}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
