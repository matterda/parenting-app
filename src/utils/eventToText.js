// eventToText: returns the descriptive part only — the type badge in the UI already
// shows the event type, so we don't repeat it here.

export function eventToText(event) {
  const time = formatTime(event.timestamp_start)
  const d = event.data ?? {}

  switch (event.type) {
    case 'feed': {
      const vol = d.volume_ml != null ? (d.volume_estimated ? ` ~${d.volume_ml}ml est.` : ` ${d.volume_ml}ml`) : ''
      const dur = d.duration_min != null ? ` for ${d.duration_min} min` : ''
      const side = d.side && d.side !== 'null' ? ` (${d.side} side)` : ''
      let source
      if (d.method === 'breast') {
        source = 'breast'
      } else if (d.milk_type === 'breast_milk') {
        source = 'bottle (expressed)'
      } else if (d.milk_type === 'formula') {
        source = 'bottle (formula)'
      } else {
        source = 'bottle'
      }
      return `${source}${vol}${dur}${side} · ${time}`
    }
    case 'pumping': {
      const vol = d.volume_ml != null ? `${d.volume_ml}ml` : ''
      const dur = d.duration_min != null ? ` for ${d.duration_min} min` : ''
      const side = d.side && d.side !== 'null' ? ` (${d.side})` : ''
      return `${vol}${dur}${side} · ${time}`.replace(/^\s*·/, '·').trim()
    }
    case 'sleep': {
      const end = event.timestamp_end ? ` → ${formatTime(event.timestamp_end)}` : ' (ongoing)'
      return `${time}${end}`
    }
    case 'diaper': {
      const diaperLabel = { wet: 'pee', dirty: 'poo', both: 'pee + poo' }[d.kind] ?? d.kind ?? 'unknown'
      return `${diaperLabel} · ${time}`
    }
    case 'weight':
      return `${d.value} ${d.unit} · ${time}`
    case 'weighin': {
      const delta = d.delta_g != null ? ` → ${d.delta_g > 0 ? '+' : ''}${d.delta_g} g` : ''
      return `${d.value} ${d.unit} (clothed)${delta} · ${time}`
    }
    case 'temperature':
      return `${d.value}°${d.unit} · ${time}`
    case 'medication':
      return `${d.name}${d.dose ? ` ${d.dose}` : ''} · ${time}`
    case 'milestone':
      return `${d.label} · ${time}`
    case 'reminder': {
      const status = event.timestamp_end ? `done ${formatTime(event.timestamp_end)}` : 'to do'
      return `${d.text ?? ''} · ${status}`
    }
    case 'question_for_pediatrician':
      return time
    case 'note':
    default:
      return time
  }
}

// Maps event field names to human-readable labels for the confirmation UI
export const FIELD_LABELS = {
  timestamp_start: 'start time',
  timestamp_end: 'end time',
  volume_ml: 'volume (ml)',
  duration_min: 'duration (min)',
  milk_type: 'milk type',
  side: 'side',
  kind: 'diaper type',
  value: 'value',
  name: 'name',
  dose: 'dose',
  label: 'label',
}

function formatTime(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
