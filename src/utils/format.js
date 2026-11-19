// Display helpers shared by pages and components. Times are UNIX seconds.

const CATEGORY_EMOJI = {
  sports: '🏀',
  academic: '📚',
  arts: '🎭',
  clubs: '🧩',
  social: '🎉',
  career: '💼',
}

// Placeholder glyph for events without a picture.
export const categoryEmoji = (categoryId) => CATEGORY_EMOJI[categoryId] ?? '📅'

// Deleted accounts (is_active = false) show as "Deleted account" everywhere.
export function displayName(user) {
  return user?.is_active ? user.full_name : 'Deleted account'
}

// What a chat is called: the user's own label (`chat_name`), or by default the
// event title for group chats and the other person's name for direct chats.
// Takes rows from listChats() / getChat() in src/api.jsx.
export function chatTitle(chat) {
  if (chat.chat_name) return chat.chat_name
  return chat.event_id ? (chat.event?.event_title ?? 'Event chat') : displayName(chat.other)
}

// The name a chat shows when it has no label (the text field's placeholder).
export function defaultChatTitle(chat) {
  return chatTitle({ ...chat, chat_name: null })
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function formatDay(date) {
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

const isSameDay = (a, b) => a.toDateString() === b.toDateString()

// "Sat, Nov 8 · 2:00 PM", plus " – 4:00 PM" (or another day) when there's an end.
// All-day events are saved as midnight to 23:59:59 in the organizer's time
// zone. Reading each day from 12 hours inside those ends gives the same
// calendar days for anyone within 12 hours of the organizer's time zone
// (instead of shifting by a day for anyone west or east of them). Returns
// local midnight of the first and last day.
const HALF_DAY = 12 * 60 * 60
export function allDayDates(start, end) {
  const localMidnight = (seconds) => {
    const date = new Date(seconds * 1000)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }
  const first = localMidnight(start + HALF_DAY)
  const last = localMidnight(Math.max((end ?? start) - HALF_DAY, start + HALF_DAY))
  return { first, last }
}

// All-day events read "Sat, Nov 8 · All day" or "Sat, Nov 8 – Mon, Nov 10 · All day".
export function formatEventTime(start, end, allDay = false) {
  const startDate = new Date(start * 1000)
  if (allDay) {
    const { first, last } = allDayDates(start, end)
    const days = isSameDay(first, last) ? formatDay(first) : `${formatDay(first)} – ${formatDay(last)}`
    return `${days} · All day`
  }
  const text = `${formatDay(startDate)} · ${timeFormat.format(startDate)}`
  if (end == null) return text
  const endDate = new Date(end * 1000)
  if (isSameDay(startDate, endDate)) return `${text} – ${timeFormat.format(endDate)}`
  return `${text} – ${formatDay(endDate)} · ${timeFormat.format(endDate)}`
}

// Short timestamp for comments: "Nov 8, 2:15 PM".
export function formatTimestamp(seconds) {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const pad = (n) => String(n).padStart(2, '0')

// <input type="date"> uses local "YYYY-MM-DD" strings.
export function toDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// First and last second of a "YYYY-MM-DD" day in local time, or null if empty.
export const startOfDay = (value) => (value ? Math.floor(new Date(`${value}T00:00:00`).getTime() / 1000) : null)
export const endOfDay = (value) => (value ? Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000) : null)

// <input type="datetime-local"> uses local "YYYY-MM-DDTHH:MM" strings.
export function toDateTimeInput(seconds) {
  if (seconds == null) return ''
  const date = new Date(seconds * 1000)
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// "YYYY-MM-DDTHH:MM" is read as local time, so the result is the same moment
// wherever the organizer is.
export function fromDateTimeInput(value) {
  return value ? Math.floor(new Date(value).getTime() / 1000) : null
}

// An all-day event's days as "YYYY-MM-DD" strings for <input type="date">
// (see allDayDates()).
export function allDayInputs(start, end) {
  const { first, last } = allDayDates(start, end)
  return { firstDay: toDateInput(first), lastDay: toDateInput(last) }
}

// The device's time zone, e.g. "EST" or "GMT+1", for form hints.
export function timeZoneLabel(date = new Date()) {
  const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName')
  return part?.value ?? ''
}
