// Feed reminder notifications + overdue status for the in-app banner.

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
  if (filter === 'bottle') return ev.data?.method === 'bottle' // any bottle, regardless of milk type
  return true
}

function lastMatchingFeed(events, filter) {
  return events
    .filter(e => e.extracted && e.type === 'feed' && feedMatchesFilter(e, filter))
    .sort((a, b) => new Date(b.timestamp_start) - new Date(a.timestamp_start))[0] ?? null
}

// Returns overdue info for the in-app banner.
// { overdue: bool, sinceMin: number, lastFeed: event|null }
export function getFeedOverdueStatus(events) {
  const settings = getNotifSettings()
  if (!settings.enabled) return { overdue: false, sinceMin: 0, lastFeed: null }

  const last = lastMatchingFeed(events, settings.feedFilter)
  if (!last) return { overdue: false, sinceMin: 0, lastFeed: null }

  const sinceMin = Math.round((Date.now() - new Date(last.timestamp_start).getTime()) / 60000)
  const overdue = sinceMin >= settings.delayHours * 60

  return { overdue, sinceMin, lastFeed: last, milkType: milkLabel(last) }
}

// Human-readable milk type label for a feed event.
export function milkLabel(feedEvent) {
  const d = feedEvent?.data ?? {}
  // A direct breast feed often has milk_type null but is always breast milk.
  if (d.method === 'breast') return 'breast milk'
  const mt = d.milk_type
  if (!mt) return null
  if (mt === 'breast_milk') return 'breast milk'
  if (mt === 'formula')     return 'formula'
  if (mt === 'mixed')       return 'mixed'
  return mt
}

// ─── OS notification scheduling ──────────────────────────────────────────────
// Tracks the feed ID for which a notification was last fired, to avoid
// re-firing the same overdue notification on every scheduleCheck call.
let _scheduledTimeout = null
let _notifiedForFeedId = null

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
    // Overdue — fire once per feed event (don't repeat on every scheduleCheck call)
    if (_notifiedForFeedId !== last.id) {
      _notifiedForFeedId = last.id
      fireNotification(settings.delayHours, milkLabel(last))
    }
    return
  }

  // Not yet due — schedule for when it becomes due
  _notifiedForFeedId = null
  _scheduledTimeout = setTimeout(() => {
    _notifiedForFeedId = last.id
    fireNotification(settings.delayHours, milkLabel(last))
  }, msUntilDue)
}

function fireNotification(delayHours, milk) {
  const feedDesc = milk ? `last ${milk} feed` : 'last feed'
  try {
    new Notification('Baby Log — Feed reminder', {
      body: `It's been ${delayHours}h since the ${feedDesc}. Time to check in!`,
      icon: './icon-192.png',
      tag: 'feed-reminder',
    })
  } catch (e) {
    console.warn('Notification failed:', e)
  }
}
