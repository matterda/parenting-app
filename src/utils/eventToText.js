export function eventToText(event) {
  const time = formatTime(event.timestamp_start)
  const d = event.data ?? {}

  switch (event.type) {
    case 'feed': {
      const vol = d.volume_ml != null ? ` ${d.volume_ml}ml` : ''
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
      return `Fed · ${source}${vol}${dur}${side} · ${time}`
    }
    case 'pumping': {
      const vol = d.volume_ml != null ? ` ${d.volume_ml}ml` : ''
      const dur = d.duration_min != null ? ` for ${d.duration_min} min` : ''
      const side = d.side && d.side !== 'null' ? ` (${d.side})` : ''
      return `Pumping${vol}${dur}${side} · ${time}`
    }
    case 'sleep': {
      const end = event.timestamp_end ? ` → ${formatTime(event.timestamp_end)}` : ' (ongoing)'
      return `Sleep · ${time}${end}`
    }
    case 'diaper': {
      const diaperLabel = { wet: 'pee', dirty: 'poo', both: 'pee + poo' }[d.kind] ?? d.kind ?? 'unknown'
      return `Diaper · ${diaperLabel} · ${time}`
    }
    case 'weight':
      return `Weight · ${d.value} ${d.unit} · ${time}`
    case 'temperature':
      return `Temperature · ${d.value}°${d.unit} · ${time}`
    case 'medication':
      return `Medication · ${d.name}${d.dose ? ` ${d.dose}` : ''} · ${time}`
    case 'milestone':
      return `Milestone · ${d.label} · ${time}`
    case 'question_for_pediatrician':
      return `Question for pediatrician · ${time}`
    case 'note':
    default:
      return `Note · ${time}`
  }
}

// Maps event field names to human-readable labels for the confirmation UI
export const FIELD_LABELS = {
  timestamp_start: 'start time',
  timestamp_end: 'end time',
  volume_ml: 'volume (ml)',
  duration_min: 'duration (min)',
  milk_type: 'milk type',
  // pumping shares volume_ml, duration_min, side
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
