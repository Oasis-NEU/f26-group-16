// Headcount helpers for events with an optional limit (`max_participants`,
// null = no limit). Event rows from api.jsx carry `joined: [{ count }]`.

// How many people joined, from the count api.jsx attaches to event rows.
export const joinedCount = (event) => event?.joined?.[0]?.count ?? 0

export const isFull = (event) => event?.max_participants != null && joinedCount(event) >= event.max_participants

// "4/10 · 6 spots left", "9/10 · 1 spot left", or "10/10 · Full".
// Null when the event has no limit, so callers keep their usual display.
export function spotsLabel(count, max) {
  if (max == null) return null
  const left = Math.max(0, max - count)
  if (left === 0) return `${count}/${max} · Full`
  return `${count}/${max} · ${left} ${left === 1 ? 'spot' : 'spots'} left`
}
