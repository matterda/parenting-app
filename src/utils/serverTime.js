// Estimated server clock, so updated_at ordering doesn't depend on each phone's
// local clock (which can be minutes off). We learn the offset between this
// device and the Firebase server, then stamp updated_at as server-estimated
// time. Values stay ISO-8601 UTC strings so existing comparisons keep working.

const KEY = 'server_time_offset_ms'

let offset = 0
try { offset = Number(localStorage.getItem(KEY)) || 0 } catch { offset = 0 }

// Current time adjusted to the server clock, as an ISO string.
export function serverNow() {
  return new Date(Date.now() + offset).toISOString()
}

export function getServerOffset() {
  return offset
}

export function setServerOffset(ms) {
  offset = ms
  try { localStorage.setItem(KEY, String(ms)) } catch { /* ignore quota */ }
}
