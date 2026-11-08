// Week-calendar math for the schedule page: week boundaries, clipping events
// to day columns, and side-by-side layout for overlapping blocks. Pure
// functions; times on events are UNIX seconds, positions are in hours.

import { eventEnd } from './schedule.js'

// Short events still get a block tall enough to read and click.
export const MIN_BLOCK_HOURS = 0.5
// Hours always shown; the range grows to fit events outside it.
export const DEFAULT_HOURS = [8, 22]

export const toSeconds = (date) => Math.floor(date.getTime() / 1000)
export const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)

// Local midnight of the Sunday on or before `date`.
export function startOfWeek(date) {
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -date.getDay())
}

export const weekDays = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

// "Nov 9 – 15", "Nov 30 – Dec 6", or "Dec 28, 2026 – Jan 3, 2027".
export function formatWeekLabel(weekStart) {
  const last = addDays(weekStart, 6)
  const thisYear = new Date().getFullYear()
  const crossesYear = weekStart.getFullYear() !== last.getFullYear()
  const showYear = crossesYear || weekStart.getFullYear() !== thisYear
  const first = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: crossesYear ? 'numeric' : undefined })
  const sameMonth = weekStart.getMonth() === last.getMonth() && !crossesYear
  const end = last.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: showYear ? 'numeric' : undefined,
  })
  return `${first} – ${end}`
}

// Each item is { event, kind }. Returns the items that touch `day`, clipped to
// it, with `top`/`bottom` in hours since local midnight. `bottom` is stretched
// to MIN_BLOCK_HOURS so tiny events stay visible (and lay out that way too).
export function daySegments(items, day) {
  const dayStart = toSeconds(day)
  const dayEnd = toSeconds(addDays(day, 1))
  const segments = []
  for (const item of items) {
    const start = item.event.start_time
    const end = eventEnd(item.event)
    if (start >= dayEnd || end <= dayStart) continue
    const top = (Math.max(start, dayStart) - dayStart) / 3600
    const realBottom = (Math.min(end, dayEnd) - dayStart) / 3600
    segments.push({ ...item, top, bottom: Math.min(24, Math.max(realBottom, top + MIN_BLOCK_HOURS)) })
  }
  return segments
}

// Places overlapping segments side by side. Adds `column` (0-based) and
// `columns` (how many share that stretch of time) to each segment.
export function layoutDay(segments) {
  const sorted = [...segments].sort((a, b) => a.top - b.top || b.bottom - a.bottom)
  const placed = []
  let cluster = []
  let columnEnds = []
  let clusterEnd = -Infinity

  const closeCluster = () => {
    for (const segment of cluster) segment.columns = columnEnds.length
    cluster = []
    columnEnds = []
  }

  for (const segment of sorted) {
    if (segment.top >= clusterEnd) {
      closeCluster()
      clusterEnd = -Infinity
    }
    let column = columnEnds.findIndex((end) => end <= segment.top)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(segment.bottom)
    } else {
      columnEnds[column] = segment.bottom
    }
    const result = { ...segment, column }
    cluster.push(result)
    placed.push(result)
    clusterEnd = Math.max(clusterEnd, segment.bottom)
  }
  closeCluster()
  return placed
}

// [firstHour, lastHour] to draw: DEFAULT_HOURS, widened to fit every segment.
export function hourRange(segmentLists, [from, to] = DEFAULT_HOURS) {
  let first = from
  let last = to
  for (const segments of segmentLists) {
    for (const segment of segments) {
      first = Math.min(first, Math.floor(segment.top))
      last = Math.max(last, Math.ceil(segment.bottom))
    }
  }
  return [Math.max(0, first), Math.min(24, last)]
}
