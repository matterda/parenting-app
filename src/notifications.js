// Feed reminder notifications.
// Only works while the PWA is open (no push server).

export function getNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem('notif_settings') ?? 'null') ?? {
      enabled: false,
      delayHours: 3,
      feedFilter: 'any', // 'any' | 'formula' | 'breast'
    }
  } catch {
    return { enabled: false, delayHours: 3, feedFilter: 'any' }
  }
}

export function saveNotifSettings(settings) {
  localStorage.setItem('notif_settings', JSON.stringify(settings))
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  const result = await Notification.requestPermission()
  return result
}

function feedMatchesFilter(ev, filter) {
  if (filter === 'any') return true
  if (filter === 'formula') return ev.data?.milk_type === 'formula'
  if (filter === 'breast') return ev.data?.method === 'breast' || ev.data?.milk_type === 'breast_milk'
  return true
}

// Find the most recent feed matching the filter
function lastMatchingFeed(events, filter) {
  const feeds = events
    .filter(e => e.extracted && e.type === 'feed' && feedMatchesFilter(e, filter))
    .sort((a, b) => (a.timestamp_start < b.timestamp_start ? 1 : -1))
  return feeds[0] ?? null
}

let _scheduledTimeout = null

export function scheduleCheck(events) {
  const settings = getNotifSettings()
  if (!settings.enabled) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  if (_scheduledTimeout) {
    clearTimeout(_scheduledTimeout)
    _scheduledTimeout = null
  }

  const last = lastMatchingFeed(events, settings.feedFilter)
  if (!last) return

  const dueAt = new Date(last.timestamp_start).getTime() + settings.delayHours * 3_600_000
  const msUntilDue = dueAt - Date.now()

  if (msUntilDue <= 0) {
    // Already overdue — fire immediately (once)
    fireNotification(settings.delayHours)
    return
  }

  _scheduledTimeout = setTimeout(() => {
    fireNotification(settings.delayHours)
  }, msUntilDue)
}

function fireNotification(delayHours) {
  try {
    new Notification('Baby Log — Feed reminder', {
      body: `It's been ${delayHours}h since the last feed. Time to check in!`,
      icon: './icon-192.png',
      tag: 'feed-reminder', // replaces any previous reminder
    })
  } catch (e) {
    console.warn('Notification failed:', e)
  }
}
