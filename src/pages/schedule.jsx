import { useEffect, useMemo, useState } from 'react'
import { joinEvent, leaveEvent, listEvents, listEventsByOrganizer, listJoinedEvents } from '../api.jsx'
import { ErrorMessage, secondaryButton, smallButton } from '../components/ui.jsx'
import WeekCalendar from '../components/WeekCalendar.jsx'
import { addDays, formatWeekLabel, startOfWeek, toSeconds } from '../utils/calendar.js'
import { HOME_PATH } from '../utils/routes.js'
import { REGULAR_HOURS, eventEnd, findConflicts, suggestEvents } from '../utils/schedule.js'

// Most suggestions shown in one week, so the calendar doesn't get crowded.
const SUGGESTIONS_PER_WEEK = 8

const nowSeconds = () => Math.floor(Date.now() / 1000)

// Keeps the joined list sorted by start time when an event is added back.
const insertSorted = (events, event) => [...events, event].sort((a, b) => a.start_time - b.start_time)
const without = (events, eventId) => events.filter((event) => event.event_id !== eventId)
const inWeek = (events, from, to) => events.filter((event) => event.start_time < to && eventEnd(event) > from)

const hourName = (hour) => new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' })
const REGULAR_HOURS_LABEL = `${hourName(REGULAR_HOURS[0])} and ${hourName(REGULAR_HOURS[1])}`

function Switch({ label, on, onToggle, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-3 rounded-xl py-1 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`}
    >
      {label}
      <span
        aria-hidden="true"
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none ${
          on ? 'bg-brand-500' : 'bg-line'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full shadow transition-transform motion-reduce:transition-none ${
            on ? 'translate-x-5.5 bg-surface' : 'translate-x-0.5 bg-muted'
          }`}
        />
      </span>
    </button>
  )
}

// One line under the toolbar: suggestion status, or a nudge when the week is empty.
function StatusLine({ children }) {
  return (
    <p className="text-sm text-muted" aria-live="polite">
      {children}
    </p>
  )
}

export default function Schedule({ profile }) {
  const [now, setNow] = useState(nowSeconds)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  // Which day column shows on phones (0 = Sunday).
  const [selectedIndex, setSelectedIndex] = useState(() => new Date().getDay())

  const [joinedRetries, setJoinedRetries] = useState(0)
  // { key, events, hosted } or { key, error }; key = the retry it was loaded
  // for. `events` are the joined ones, `hosted` the ones the user organizes.
  const [joined, setJoined] = useState(null)

  // Suggestions start off and aren't saved anywhere. Results are cached per
  // week (and retry), so toggling or going back to a week doesn't refetch.
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Off: suggestions stay within REGULAR_HOURS. Also page state only.
  const [anyHour, setAnyHour] = useState(false)
  const [suggestRetries, setSuggestRetries] = useState(0)
  const [suggestCache, setSuggestCache] = useState({})

  // Events with a join/leave request in flight, so they can't be toggled twice.
  const [pending, setPending] = useState({})
  const [actionError, setActionError] = useState('')

  // Keeps the "now" line and past-event dimming current.
  useEffect(() => {
    const id = setInterval(() => setNow(nowSeconds()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const key = joinedRetries
    Promise.all([listJoinedEvents(profile.uid), listEventsByOrganizer(profile.uid)])
      .then(([joinedRows, hostedRows]) => {
        if (cancelled) return
        const hosted = [...hostedRows].sort((a, b) => a.start_time - b.start_time)
        // Organizers can't join their own events, but drop any old rows so a
        // hosted event never shows twice (or with a Leave button).
        const hostedIds = new Set(hosted.map((event) => event.event_id))
        setJoined({ key, events: joinedRows.filter((event) => !hostedIds.has(event.event_id)), hosted })
      })
      .catch((err) => !cancelled && setJoined({ key, error: err.message }))
    return () => {
      cancelled = true
    }
  }, [profile.uid, joinedRetries])

  const weekFrom = toSeconds(weekStart)
  const weekTo = toSeconds(addDays(weekStart, 7))
  const weekIsPast = weekTo <= now
  const suggestKey = `${weekFrom}:${suggestRetries}`
  const weekSuggestions = suggestCache[suggestKey]
  const needsFetch = showSuggestions && !weekIsPast && !weekSuggestions

  useEffect(() => {
    if (!needsFetch) return
    let cancelled = false
    listEvents({ from: Math.max(weekFrom, nowSeconds()), to: weekTo - 1 })
      .then((events) => !cancelled && setSuggestCache((cache) => ({ ...cache, [suggestKey]: { events } })))
      .catch((err) => !cancelled && setSuggestCache((cache) => ({ ...cache, [suggestKey]: { error: err.message } })))
    return () => {
      cancelled = true
    }
  }, [needsFetch, suggestKey, weekFrom, weekTo])

  const joinedLoading = joined?.key !== joinedRetries
  const joinedEvents = joined?.events
  const hostedEvents = joined?.hosted

  const weekJoined = useMemo(() => inWeek(joinedEvents ?? [], weekFrom, weekTo), [joinedEvents, weekFrom, weekTo])
  const weekHosted = useMemo(() => inWeek(hostedEvents ?? [], weekFrom, weekTo), [hostedEvents, weekFrom, weekTo])
  // Everything the user will be at: joined events plus the ones they host.
  const busyEvents = useMemo(() => [...(joinedEvents ?? []), ...(hostedEvents ?? [])], [joinedEvents, hostedEvents])
  const conflicts = useMemo(() => findConflicts([...weekJoined, ...weekHosted]), [weekJoined, weekHosted])
  const suggestions = useMemo(() => {
    if (!showSuggestions || !joinedEvents || !weekSuggestions?.events) return []
    return suggestEvents({
      candidates: weekSuggestions.events.filter((event) => !pending[event.event_id]),
      joined: joinedEvents,
      busy: busyEvents,
      uid: profile.uid,
      now,
      hours: anyHour ? null : REGULAR_HOURS,
      limit: SUGGESTIONS_PER_WEEK,
    })
  }, [showSuggestions, anyHour, joinedEvents, busyEvents, weekSuggestions, pending, profile.uid, now])

  const items = useMemo(
    () => [
      ...weekJoined.map((event) => ({ event, kind: 'joined' })),
      ...weekHosted.map((event) => ({ event, kind: 'hosted' })),
      ...suggestions.map((event) => ({ event, kind: 'suggested' })),
    ],
    [weekJoined, weekHosted, suggestions],
  )

  const thisWeekStart = startOfWeek(new Date(now * 1000))
  const onThisWeek = weekStart.getTime() === thisWeekStart.getTime()
  const nextEvent = busyEvents
    .filter((event) => event.start_time >= weekTo)
    .reduce((soonest, event) => (!soonest || event.start_time < soonest.start_time ? event : soonest), null)

  const goToWeek = (date) => {
    setWeekStart(startOfWeek(date))
    setSelectedIndex(date.getDay())
  }
  const shiftWeek = (weeks) => setWeekStart((start) => addDays(start, weeks * 7))

  // Shared by remove and add: update the calendar right away, roll back on failure.
  const changeJoin = async (event, { apply, undo, request, verb }) => {
    const id = event.event_id
    if (pending[id]) return
    setActionError('')
    setPending((p) => ({ ...p, [id]: true }))
    setJoined((j) => ({ ...j, events: apply(j.events) }))
    try {
      await request(id, profile.uid)
    } catch (err) {
      setJoined((j) => ({ ...j, events: undo(j.events) }))
      setActionError(`Couldn’t ${verb} “${event.event_title}”. ${err.message}`)
    }
    setPending(({ [id]: _done, ...rest }) => rest)
  }

  const removeEvent = (event) =>
    changeJoin(event, {
      apply: (events) => without(events, event.event_id),
      undo: (events) => insertSorted(events, event),
      request: leaveEvent,
      verb: 'remove',
    })

  const addEvent = (event) =>
    changeJoin(event, {
      apply: (events) => insertSorted(events, event),
      undo: (events) => without(events, event.event_id),
      request: joinEvent,
      verb: 'add',
    })

  let status = null
  if (joinedEvents) {
    if (busyEvents.length === 0 && !showSuggestions) {
      status = (
        <StatusLine>
          You haven’t joined anything yet.{' '}
          <a href={HOME_PATH} className="font-semibold text-brand-600 hover:underline">
            Browse events
          </a>{' '}
          or turn on suggestions.
        </StatusLine>
      )
    } else if (showSuggestions && weekIsPast) {
      status = <StatusLine>No suggestions for past weeks.</StatusLine>
    } else if (showSuggestions && !weekSuggestions) {
      status = <StatusLine>Looking for open slots…</StatusLine>
    } else if (showSuggestions && weekSuggestions.error) {
      status = (
        <div className="flex flex-wrap items-center gap-3">
          <ErrorMessage message={`Couldn’t load suggestions. ${weekSuggestions.error}`} />
          <button type="button" onClick={() => setSuggestRetries((n) => n + 1)} className={smallButton}>
            Try again
          </button>
        </div>
      )
    } else if (showSuggestions) {
      status = (
        <StatusLine>
          {suggestions.length === 0
            ? `Nothing fits your open time this week${anyHour ? '' : ` between ${REGULAR_HOURS_LABEL}`}.`
            : `${suggestions.length} ${suggestions.length === 1 ? 'event fits' : 'events fit'} your open time this week${
                anyHour ? '' : ` between ${REGULAR_HOURS_LABEL}`
              }. They’re the dashed ones. Tap + to add.`}
        </StatusLine>
      )
    } else if (weekJoined.length === 0 && weekHosted.length === 0) {
      status = (
        <StatusLine>
          Nothing on your calendar this week.
          {nextEvent && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => goToWeek(new Date(nextEvent.start_time * 1000))}
                className="font-semibold text-brand-600 hover:underline"
              >
                Jump to your next event
              </button>
            </>
          )}
        </StatusLine>
      )
    }
  }

  let calendar
  if (!joined || (joinedLoading && joined.error)) {
    calendar = <div className="h-[28rem] animate-pulse rounded-2xl border border-line bg-brand-50 motion-reduce:animate-none" aria-hidden="true" />
  } else if (joined.error) {
    calendar = (
      <div className="space-y-4">
        <ErrorMessage message={joined.error} />
        <button type="button" onClick={() => setJoinedRetries((n) => n + 1)} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  } else {
    calendar = (
      <WeekCalendar
        weekStart={weekStart}
        selectedIndex={selectedIndex}
        onSelectDay={setSelectedIndex}
        items={items}
        conflicts={conflicts}
        pending={pending}
        now={now}
        onRemove={removeEvent}
        onAdd={addEvent}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Your schedule</h1>
          <p className="mt-2 text-muted">Everything you’ve joined or are hosting, plus stuff that fits your free time.</p>
        </div>
        {/* One row from `sm` up, so the calendar's height math still fits. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 self-start sm:flex-nowrap sm:self-auto">
          <Switch label="Suggest events" on={showSuggestions} onToggle={() => setShowSuggestions((on) => !on)} />
          {showSuggestions && (
            <Switch label="Include early & late events" on={anyHour} onToggle={() => setAnyHour((on) => !on)} />
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className={smallButton}>
          <span aria-hidden="true">‹</span>
        </button>
        <button type="button" onClick={() => goToWeek(new Date(now * 1000))} disabled={onThisWeek} className={smallButton}>
          This week
        </button>
        <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className={smallButton}>
          <span aria-hidden="true">›</span>
        </button>
        <h2 className="ml-1 text-lg font-bold text-ink" aria-live="polite">
          {formatWeekLabel(weekStart)}
        </h2>
      </div>

      <div className="mt-3 min-h-5 space-y-2">
        {status}
        <ErrorMessage message={actionError} />
      </div>

      <section aria-label="Week calendar" aria-busy={joinedLoading || (showSuggestions && needsFetch)} className="mt-4">
        {calendar}
      </section>
    </div>
  )
}
