import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { displayName, formatEventTime } from '../utils/format.js'
import EventPicture from './EventPicture.jsx'

// Details card shown next to a schedule calendar block while it's hovered or
// focused, with a Join/Leave button. Rendered into <body> so the calendar's
// rounded, overflow-hidden frame can't clip it. The mouse can move from the
// block onto the card: WeekCalendar keeps it open while either is hovered
// (onPointerEnter/onPointerLeave below).

const GAP = 6
const EDGE = 8

// AGENTS.md large button (rounded-xl, px-6 py-3, font-semibold, shadow-md),
// a bit smaller on phones so the card stays compact.
const buttonBase =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:py-3 sm:text-base'
const joinButton = `${buttonBase} bg-brand-500 text-white hover:bg-brand-600`
const leaveButton = `${buttonBase} border border-line bg-surface text-ink hover:bg-brand-50`

// Puts the card beside the anchor (right, else left); if neither side fits,
// as on phones, below it (or above), and always inside the viewport.
function place(card, anchor) {
  const { innerWidth: vw, innerHeight: vh } = window
  const width = card.offsetWidth
  const height = card.offsetHeight
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))
  let left
  let top
  if (anchor.right + GAP + width <= vw - EDGE) {
    left = anchor.right + GAP
    top = clamp(anchor.top, EDGE, vh - height - EDGE)
  } else if (anchor.left - GAP - width >= EDGE) {
    left = anchor.left - GAP - width
    top = clamp(anchor.top, EDGE, vh - height - EDGE)
  } else {
    left = clamp(anchor.left, EDGE, vw - width - EDGE)
    const below = anchor.bottom + GAP
    top = below + height <= vh - EDGE ? below : clamp(anchor.top - GAP - height, EDGE, vh - height - EDGE)
  }
  card.style.left = `${Math.round(left)}px`
  card.style.top = `${Math.round(top)}px`
}

export default function EventPopover({
  id,
  event,
  anchor,
  joined,
  busy,
  conflict,
  onToggleJoin,
  onClose,
  onPointerEnter,
  onPointerLeave,
}) {
  const ref = useRef(null)
  const titleId = useId()

  // Position before paint, so it never flashes in the wrong spot. Re-run when
  // the content changes size (e.g. Join → Leave).
  useLayoutEffect(() => {
    if (ref.current) place(ref.current, anchor)
  }, [anchor, event, joined, conflict])

  // The card is fixed to where the block was, so close it when the page
  // scrolls or resizes, or on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="fixed left-0 top-0 z-50 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-lg sm:w-80 lg:w-96"
    >
      <EventPicture event={event} className="h-24 sm:h-28 lg:h-36" glyphClass="text-4xl" />
      <div className="space-y-2 p-4 text-sm lg:space-y-3 lg:p-5">
        <div>
          <p className="font-semibold text-brand-600">{formatEventTime(event.start_time, event.end_time)}</p>
          <h3 id={titleId} className="line-clamp-2 text-base font-bold leading-snug text-ink lg:text-lg">
            {event.event_title}
          </h3>
        </div>
        <p className="truncate text-muted">
          <span aria-hidden="true">👤 </span>
          {displayName(event.organizer)}
        </p>
        {event.location && (
          <p className="line-clamp-2 text-muted">
            <span aria-hidden="true">📍 </span>
            {event.location}
          </p>
        )}
        {event.event_description && (
          <p className="line-clamp-4 whitespace-pre-line text-ink">{event.event_description}</p>
        )}
        {conflict && (
          <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs font-semibold text-danger">
            <span aria-hidden="true">⚠️ </span>Overlaps with {conflict.join(', ')}
          </p>
        )}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onToggleJoin(event)}
            disabled={busy}
            aria-pressed={joined}
            className={joined ? leaveButton : joinButton}
          >
            {!joined && <span aria-hidden="true">＋</span>}
            {joined ? 'Leave event' : 'Join event'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
