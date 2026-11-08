// Scheduling helpers for the personal schedule page. Pure functions on event
// rows (times are UNIX seconds), so they're easy to check without React.
// Kept apart from format.js so schedule work doesn't touch shared files.

// ---------- display ----------

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const isSameDay = (a, b) => a.toDateString() === b.toDateString()

// "Sat, Nov 8", with the year only when it isn't this year (same as format.js).
function formatDay(date) {
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

// Times only, for calendar blocks (the column already shows the day):
// "2:00 PM – 4:00 PM", or "2:00 PM – Sun, Nov 9 · 1:00 AM" when it ends on
// another day.
export function formatTimeRange(start, end) {
  const startDate = new Date(start * 1000)
  const text = timeFormat.format(startDate)
  if (end == null) return text
  const endDate = new Date(end * 1000)
  if (isSameDay(startDate, endDate)) return `${text} – ${timeFormat.format(endDate)}`
  return `${text} – ${formatDay(endDate)} · ${timeFormat.format(endDate)}`
}

// ---------- scheduling ----------

// Events without an end time are treated as an hour long for overlap checks.
export const DEFAULT_DURATION = 60 * 60

export const eventEnd = (event) => event.end_time ?? event.start_time + DEFAULT_DURATION

// True when two events share any time. Back-to-back events don't count.
export const overlaps = (a, b) => a.start_time < eventEnd(b) && b.start_time < eventEnd(a)

// { [event_id]: [titles of other events it overlaps] } for events with clashes.
export function findConflicts(events) {
  const conflicts = {}
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]
      if (!overlaps(a, b)) continue
      ;(conflicts[a.event_id] ??= []).push(b.event_title)
      ;(conflicts[b.event_id] ??= []).push(a.event_title)
    }
  }
  return conflicts
}

// Events that fit the user's open time: not joined, not their own, not started
// yet, and not overlapping anything they joined. Categories the user joins most
// come first, then the soonest.
export function suggestEvents({ candidates, joined, uid, now, limit = 6 }) {
  const joinedIds = new Set(joined.map((event) => event.event_id))
  const categoryCounts = {}
  for (const event of joined) {
    if (event.category_id) categoryCounts[event.category_id] = (categoryCounts[event.category_id] ?? 0) + 1
  }
  const score = (event) => categoryCounts[event.category_id] ?? 0

  return candidates
    .filter(
      (event) =>
        !joinedIds.has(event.event_id) &&
        event.organizer_uid !== uid &&
        event.start_time > now &&
        !joined.some((mine) => overlaps(mine, event)),
    )
    .sort((a, b) => score(b) - score(a) || a.start_time - b.start_time)
    .slice(0, limit)
}
