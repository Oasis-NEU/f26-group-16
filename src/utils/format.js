// Display helpers shared by pages and components. Times are UNIX seconds.

const CATEGORY_EMOJI = {
  sports: '🎾',
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
export function formatEventTime(start, end) {
  const startDate = new Date(start * 1000)
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

export function fromDateTimeInput(value) {
  return value ? Math.floor(new Date(value).getTime() / 1000) : null
}
