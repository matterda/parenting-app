// One-time CSV import of historical records. Deterministic — no LLM.
// One row per event; irrelevant columns may be left blank.
//
// Columns (header row required, order-independent, case-insensitive):
//   type, start, end, method, milk_type, side, volume_ml, duration_min,
//   kind, value, unit, name, dose, label, note
//
// `start` (and `end`) accept "2026-05-01 14:30" or "2026-05-01T14:30",
// interpreted in the device's local time.

import { toLocalISO } from './time'

const VALID_TYPES = new Set([
  'feed', 'sleep', 'diaper', 'pumping', 'weight',
  'temperature', 'medication', 'note', 'milestone', 'question_for_pediatrician',
])

export const CSV_TEMPLATE =
  'type,start,end,method,milk_type,side,volume_ml,duration_min,kind,value,unit,name,dose,label,note\n' +
  'feed,2026-05-01 07:30,,bottle,formula,,120,,,,,,,,first morning feed\n' +
  'feed,2026-05-01 10:00,,breast,,L,,15,,,,,,,\n' +
  'sleep,2026-05-01 12:00,2026-05-01 13:30,,,,,,,,,,,,nap\n' +
  'diaper,2026-05-01 13:35,,,,,,,both,,,,,,\n' +
  'weight,2026-05-01 09:00,,,,,,,,3.6,kg,,,,\n'

// ── tiny RFC-4180-ish CSV parser (handles quoted fields with commas/newlines) ──
function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else {
      field += c
    }
  }
  // flush trailing field/row
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function parseDate(str) {
  if (!str) return null
  const trimmed = str.trim()
  // Allow "YYYY-MM-DD HH:MM" by normalising the space to 'T'
  const d = new Date(trimmed.replace(' ', 'T'))
  if (isNaN(d.getTime())) return null
  return toLocalISO(d)
}

function num(v) {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
function str(v) {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

// Build a type-specific data object from a row's columns.
function buildData(type, r) {
  switch (type) {
    case 'feed':        return { method: str(r.method), milk_type: str(r.milk_type), side: str(r.side), volume_ml: num(r.volume_ml), duration_min: num(r.duration_min) }
    case 'pumping':     return { volume_ml: num(r.volume_ml), duration_min: num(r.duration_min), side: str(r.side) }
    case 'diaper':      return { kind: str(r.kind) }
    case 'weight':      return { value: num(r.value), unit: str(r.unit) ?? 'kg' }
    case 'temperature': return { value: num(r.value), unit: str(r.unit) ?? 'C' }
    case 'medication':  return { name: str(r.name), dose: str(r.dose) }
    case 'milestone':   return { label: str(r.label) }
    default:            return {}
  }
}

// Parse CSV text into { events, errors }. Events are ready to persist
// (extracted records); the caller adds id/updated_at via the normal write path.
export function parseEventsCsv(text) {
  const rows = parseCsvRows(text).filter(r => r.some(c => c.trim() !== ''))
  if (rows.length < 2) return { events: [], errors: ['No data rows found.'] }

  const header = rows[0].map(h => h.trim().toLowerCase())
  const events = []
  const errors = []

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    const r = {}
    header.forEach((h, idx) => { r[h] = cells[idx] ?? '' })
    const lineNo = i + 1

    const type = str(r.type)?.toLowerCase()
    if (!type) { errors.push(`Row ${lineNo}: missing type`); continue }
    if (!VALID_TYPES.has(type)) { errors.push(`Row ${lineNo}: unknown type "${type}"`); continue }

    const start = parseDate(r.start)
    if (!start) { errors.push(`Row ${lineNo}: invalid or missing start time`); continue }

    let end = null
    if (str(r.end)) {
      end = parseDate(r.end)
      if (!end) { errors.push(`Row ${lineNo}: invalid end time`); continue }
    }

    events.push({
      type,
      timestamp_start: start,
      timestamp_end: end,
      data: buildData(type, r),
      context_note: str(r.note),
      raw_text: null,
      confidence: 'high',
      needs_confirmation: [],
      extracted: true,
    })
  }

  return { events, errors }
}
