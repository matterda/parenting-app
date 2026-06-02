// Build an ISO 8601 string in local time (not UTC) with the correct offset.
// Date.prototype.toISOString() is always UTC (Z); mixing that with local-offset
// timestamps elsewhere has caused sorting/duration bugs, so all timestamp
// writes go through this helper for a consistent format.
export function toLocalISO(date) {
  const off = -date.getTimezoneOffset() // minutes ahead of UTC
  const sign = off >= 0 ? '+' : '-'
  const oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const om = String(Math.abs(off) % 60).padStart(2, '0')
  const offset = `${sign}${oh}:${om}`
  const Y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const D = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${Y}-${M}-${D}T${h}:${m}:${s}${offset}`
}
