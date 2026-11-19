// Scheduling helpers for the personal schedule page. Pure functions on event
// rows (times are UNIX seconds), so they're easy to check without React.
// Kept apart from format.js so schedule work doesn't touch shared files.

import { isFull } from './capacity.js'

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

// True when two events share any time. Back-to-back events don't count, and
// neither do all-day events: they sit in the calendar's "All day" row and
// don't take up the user's time.
export const overlaps = (a, b) =>
  !a.all_day && !b.all_day && a.start_time < eventEnd(b) && b.start_time < eventEnd(a)

// Suggestions stay within these local hours [from, to] unless the user turns
// on early & late events.
export const REGULAR_HOURS = [8, 21]

// True when the event starts at or after `from` o'clock and ends by `to`
// o'clock on the same day (local time). All-day events always fit.
export function withinHours(event, [from, to]) {
  if (event.all_day) return true
  const start = new Date(event.start_time * 1000)
  const end = new Date(eventEnd(event) * 1000)
  const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const hoursIn = (date) => (date - dayStart) / 3600000
  return hoursIn(start) >= from && hoursIn(end) <= to
}

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
// yet, not full, and not overlapping anything in `busy` (what they joined, plus
// the events they're hosting). With `hours` ([from, to], e.g. REGULAR_HOURS)
// they must also fall within those hours; null allows any time. Categories the
// user joins most come first, then the soonest.
export function suggestEvents({ candidates, joined, busy = joined, uid, now, hours = null, limit = 6 }) {
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
        // Not started yet; all-day events can be joined until their last day ends.
        (event.all_day ? eventEnd(event) > now : event.start_time > now) &&
        !isFull(event) &&
        (!hours || withinHours(event, hours)) &&
        !busy.some((mine) => overlaps(mine, event)),
    )
    .sort((a, b) => score(b) - score(a) || a.start_time - b.start_time)
    .slice(0, limit)
}
