import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { daySegments, hourRange, layoutDay, toSeconds, weekDays } from '../utils/calendar.js'
import { eventPath } from '../utils/routes.js'
import { eventEnd, formatTimeRange } from '../utils/schedule.js'
import EventPicture from './EventPicture.jsx'
import EventPopover from './EventPopover.jsx'

// Week grid with hourly timeslots for the schedule page. `items` are
// { event, kind } where kind is 'joined' (solid block) or 'suggested'
// (dashed block with an add button). Below `sm` only the selected day's
// column shows, picked from a strip of day buttons. Hovering a block for
// PREVIEW_DELAY (or focusing it) opens an EventPopover with its details and
// a Join/Leave button. Leaving the block waits CLOSE_GRACE before closing, so
// the mouse can cross the gap onto the popover, which keeps it open.

const PREVIEW_DELAY = 300
const CLOSE_GRACE = 150

// Hour rows shrink so the whole grid fits on screen: the viewport height
// minus everything above the grid (--chrome: menu bar, page header, toolbar,
// day headers; taller on phones where the header stacks), split across the
// visible hours, kept between 1.25rem and 3rem. Positions below are
// multiples of --hour.
const chromeClass = '[--chrome:29rem] sm:[--chrome:25rem]'
const hourSize = (hourCount) => `clamp(1.25rem, calc((100dvh - var(--chrome)) / ${hourCount}), 3rem)`
const hours = (n, px = 0) => `calc(var(--hour) * ${n} + ${px}px)`
const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
const weekdayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const fullDayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const gridCols = 'grid grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'

const isSameDay = (a, b) => a.toDateString() === b.toDateString()
const dayMarker = (segments) =>
  segments.some((s) => s.kind === 'joined') ? 'joined' : segments.length > 0 ? 'suggested' : null

// `marker` is 'joined', 'suggested' (only suggestions that day), or null.
function DayButton({ day, today, selected, marker, onSelect }) {
  const isToday = isSameDay(day, today)
  const note = marker === 'joined' ? ', has events' : marker === 'suggested' ? ', has suggestions' : ''
  const dotColor = selected ? 'border-current bg-current' : 'border-brand-500 bg-brand-500'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${fullDayLabel.format(day)}${note}`}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold ${
        selected ? 'bg-brand-500 text-white' : isToday ? 'text-brand-600 hover:bg-brand-50' : 'text-muted hover:bg-brand-50'
      }`}
    >
      {weekdayLabel.format(day)}
      <span className="text-base font-bold">{day.getDate()}</span>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full border ${marker ? dotColor : 'border-transparent'} ${marker === 'suggested' ? 'bg-transparent' : ''}`}
      />
    </button>
  )
}

function DayHeader({ day, today }) {
  const isToday = isSameDay(day, today)
  return (
    <div className="border-l border-line py-2 text-center" aria-label={fullDayLabel.format(day)}>
      <p className={`text-xs font-semibold uppercase ${isToday ? 'text-brand-600' : 'text-muted'}`}>{weekdayLabel.format(day)}</p>
      <p
        className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-bold ${
          isToday ? 'bg-brand-500 text-white' : 'text-ink'
        }`}
      >
        {day.getDate()}
      </p>
    </div>
  )
}

const segmentKey = (segment) => `${segment.kind}-${segment.event.event_id}`

function Block({ segment, firstHour, conflict, busy, past, describedBy, onRemove, onAdd, onPreviewStart, onPreviewLeave, onPreviewClose }) {
  const { event, kind } = segment
  const suggested = kind === 'suggested'
  const duration = segment.bottom - segment.top
  const style = {
    top: hours(segment.top - firstHour, 1),
    height: `max(${hours(duration, -2)}, 20px)`,
    left: `calc(${(segment.column / segment.columns) * 100}% + 2px)`,
    width: `calc(${100 / segment.columns}% - 4px)`,
  }
  // Rows can be as short as 20px, so short blocks get one line, mid-size
  // blocks a one-line title, and only tall ones a picture and wrapped title.
  const compact = duration < 1.5
  const showPicture = duration >= 2 && segment.columns === 1
  // Narrow or one-line blocks show just the start time, leaving room for the title.
  const time = compact || segment.columns > 1 ? formatTimeRange(event.start_time) : formatTimeRange(event.start_time, event.end_time)
  const subtle = suggested ? 'text-muted' : 'opacity-90'

  const look = suggested
    ? 'border-2 border-dashed border-brand-500 bg-brand-50 text-ink hover:bg-brand-100'
    : `bg-brand-500 text-white shadow-sm hover:bg-brand-600 ${conflict ? 'ring-2 ring-danger' : ''}`

  return (
    <div
      style={style}
      className={`absolute overflow-hidden rounded-lg ${look} ${past ? 'opacity-60' : ''}`}
      // Mouse only: on touch screens a tap goes straight to the event.
      onPointerEnter={(e) => e.pointerType === 'mouse' && onPreviewStart(segment, e.currentTarget)}
      onPointerLeave={onPreviewLeave}
      onPointerDown={onPreviewClose}
    >
      <a
        href={eventPath(event.event_id)}
        aria-describedby={describedBy}
        onFocus={(e) => onPreviewStart(segment, e.currentTarget.parentElement)}
        onBlur={onPreviewLeave}
        className={`flex h-full gap-1 rounded-lg pr-5 text-[10px] leading-[1.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-900 ${
          compact ? 'py-px pl-1' : 'p-1'
        }`}
      >
        {showPicture && (
          <div className="h-6 w-6 shrink-0 overflow-hidden rounded">
            <EventPicture event={event} className="h-full" glyphClass="text-xs" />
          </div>
        )}
        {compact ? (
          <p className="min-w-0 truncate">
            {conflict && <span aria-label="Overlaps another event">⚠️ </span>}
            <span className="font-semibold">{event.event_title}</span> <span className={subtle}>{time}</span>
          </p>
        ) : (
          <div className="min-w-0">
            <p className={`font-semibold ${duration >= 2.5 ? 'line-clamp-2' : 'truncate'}`}>
              {conflict && <span aria-label="Overlaps another event">⚠️ </span>}
              {event.event_title}
            </p>
            <p className={`truncate ${subtle}`}>{time}</p>
          </div>
        )}
      </a>
      <button
        type="button"
        onClick={() => (suggested ? onAdd : onRemove)(event)}
        disabled={busy}
        aria-label={suggested ? `Add ${event.event_title} to your schedule` : `Remove ${event.event_title} from your schedule`}
        className={`absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded text-xs font-bold leading-none disabled:opacity-50 ${
          suggested ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-white hover:bg-brand-700'
        }`}
      >
        <span aria-hidden="true">{suggested ? '+' : '×'}</span>
      </button>
    </div>
  )
}

export default function WeekCalendar({ weekStart, selectedIndex, onSelectDay, items, conflicts, pending, now, onRemove, onAdd }) {
  const days = weekDays(weekStart)
  const today = new Date(now * 1000)
  const segmentsByDay = days.map((day) => layoutDay(daySegments(items, day)))
  const [firstHour, lastHour] = hourRange(segmentsByDay)
  const hourList = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const height = hours(hourList.length)

  // Preview popover: { eventId, anchor } once a block has been hovered or
  // focused for PREVIEW_DELAY. `anchor` is the block's screen rectangle.
  const popoverId = useId()
  const [preview, setPreview] = useState(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)

  const startPreview = (segment, element) => {
    clearTimeout(closeTimer.current)
    const eventId = segment.event.event_id
    if (preview?.eventId === eventId) return
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(
      () => setPreview({ eventId, anchor: element.getBoundingClientRect() }),
      PREVIEW_DELAY,
    )
  }
  // Pointer left the block or the popover (or focus left the block).
  const leavePreview = () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setPreview(null), CLOSE_GRACE)
  }
  const keepPreview = () => clearTimeout(closeTimer.current)
  const closePreview = useCallback(() => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    setPreview(null)
  }, [])
  useEffect(
    () => () => {
      clearTimeout(openTimer.current)
      clearTimeout(closeTimer.current)
    },
    [],
  )

  // Look the event up again by id, so the popover follows it from suggested
  // to joined (and back), and closes if it leaves the week.
  const allSegments = segmentsByDay.flat()
  const previewed =
    preview &&
    (allSegments.find((s) => s.event.event_id === preview.eventId && s.kind === 'joined') ??
      allSegments.find((s) => s.event.event_id === preview.eventId))

  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-sm ${chromeClass}`} style={{ '--hour': hourSize(hourList.length) }}>
      {/* Phones: pick one day. */}
      <div role="group" aria-label="Day" className="flex gap-1 border-b border-line p-2 sm:hidden">
        {days.map((day, i) => (
          <DayButton
            key={i}
            day={day}
            today={today}
            selected={i === selectedIndex}
            marker={dayMarker(segmentsByDay[i])}
            onSelect={() => onSelectDay(i)}
          />
        ))}
      </div>
      {/* Wider screens: one column per day. */}
      <div className={`${gridCols} hidden border-b border-line sm:grid`}>
        <div />
        {days.map((day, i) => (
          <DayHeader key={i} day={day} today={today} />
        ))}
      </div>

      <div className={gridCols}>
        <div className="relative" style={{ height }} aria-hidden="true">
          {hourList.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 text-[11px] text-muted"
              style={{ top: hours(hour - firstHour, 2) }}
            >
              {hourLabel.format(new Date(2000, 0, 1, hour))}
            </span>
          ))}
        </div>

        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          const nowHours = (now - toSeconds(day)) / 3600
          return (
            <div
              key={i}
              aria-label={fullDayLabel.format(day)}
              role="group"
              className={`relative border-l border-line ${i === selectedIndex ? 'block' : 'hidden sm:block'} ${
                isToday ? 'bg-brand-50' : ''
              }`}
              style={{ height }}
            >
              {hourList.map((hour) => (
                <div
                  key={hour}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-line"
                  style={{ top: hours(hour - firstHour) }}
                />
              ))}
              {isToday && nowHours >= firstHour && nowHours <= lastHour && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 z-10 h-0.5 bg-danger"
                  style={{ top: hours(nowHours - firstHour) }}
                >
                  <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />
                </div>
              )}
              {segmentsByDay[i].map((segment) => (
                <Block
                  key={segmentKey(segment)}
                  segment={segment}
                  firstHour={firstHour}
                  conflict={segment.kind === 'joined' ? conflicts[segment.event.event_id] : null}
                  busy={Boolean(pending[segment.event.event_id])}
                  past={eventEnd(segment.event) < now}
                  describedBy={previewed && preview.eventId === segment.event.event_id ? popoverId : undefined}
                  onRemove={onRemove}
                  onAdd={onAdd}
                  onPreviewStart={startPreview}
                  onPreviewLeave={leavePreview}
                  onPreviewClose={closePreview}
                />
              ))}
            </div>
          )
        })}
      </div>

      {previewed && (
        <EventPopover
          id={popoverId}
          event={previewed.event}
          anchor={preview.anchor}
          joined={previewed.kind === 'joined'}
          busy={Boolean(pending[previewed.event.event_id])}
          conflict={previewed.kind === 'joined' ? conflicts[previewed.event.event_id] : null}
          onToggleJoin={previewed.kind === 'joined' ? onRemove : onAdd}
          onClose={closePreview}
          onPointerEnter={keepPreview}
          onPointerLeave={leavePreview}
        />
      )}
    </div>
  )
}
