import { useEffect, useMemo, useState } from 'react'
import { joinEvent, leaveEvent, listEvents, listJoinedEvents } from '../api.jsx'
import { ErrorMessage, secondaryButton, smallButton } from '../components/ui.jsx'
import WeekCalendar from '../components/WeekCalendar.jsx'
import { addDays, formatWeekLabel, startOfWeek, toSeconds } from '../utils/calendar.js'
import { HOME_PATH } from '../utils/routes.js'
import { eventEnd, findConflicts, suggestEvents } from '../utils/schedule.js'

// Most suggestions shown in one week, so the calendar doesn't get crowded.
const SUGGESTIONS_PER_WEEK = 8

const nowSeconds = () => Math.floor(Date.now() / 1000)

// Keeps the joined list sorted by start time when an event is added back.
const insertSorted = (events, event) => [...events, event].sort((a, b) => a.start_time - b.start_time)
const without = (events, eventId) => events.filter((event) => event.event_id !== eventId)

function SuggestionsSwitch({ on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-3 self-start rounded-xl py-1 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:self-auto"
    >
      Suggest events
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
  // { key, events } or { key, error }; key = the retry it was loaded for.
  const [joined, setJoined] = useState(null)

  // Suggestions start off and aren't saved anywhere. Results are cached per
  // week (and retry), so toggling or going back to a week doesn't refetch.
  const [showSuggestions, setShowSuggestions] = useState(false)
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
    listJoinedEvents(profile.uid)
      .then((events) => !cancelled && setJoined({ key, events }))
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

  const weekJoined = useMemo(
    () => (joinedEvents ?? []).filter((event) => event.start_time < weekTo && eventEnd(event) > weekFrom),
    [joinedEvents, weekFrom, weekTo],
  )
  const conflicts = useMemo(() => findConflicts(weekJoined), [weekJoined])
  const suggestions = useMemo(() => {
    if (!showSuggestions || !joinedEvents || !weekSuggestions?.events) return []
    return suggestEvents({
      candidates: weekSuggestions.events.filter((event) => !pending[event.event_id]),
      joined: joinedEvents,
      uid: profile.uid,
      now,
      limit: SUGGESTIONS_PER_WEEK,
    })
  }, [showSuggestions, joinedEvents, weekSuggestions, pending, profile.uid, now])

  const items = useMemo(
    () => [
      ...weekJoined.map((event) => ({ event, kind: 'joined' })),
      ...suggestions.map((event) => ({ event, kind: 'suggested' })),
    ],
    [weekJoined, suggestions],
  )

  const thisWeekStart = startOfWeek(new Date(now * 1000))
  const onThisWeek = weekStart.getTime() === thisWeekStart.getTime()
  const nextJoined = joinedEvents?.find((event) => event.start_time >= weekTo)

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
    if (joinedEvents.length === 0 && !showSuggestions) {
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
            ? 'Nothing fits your open time this week.'
            : `${suggestions.length} ${suggestions.length === 1 ? 'event fits' : 'events fit'} your open time this week. They’re the dashed ones. Tap + to add.`}
        </StatusLine>
      )
    } else if (weekJoined.length === 0) {
      status = (
        <StatusLine>
          Nothing on your calendar this week.
          {nextJoined && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => goToWeek(new Date(nextJoined.start_time * 1000))}
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
          <p className="mt-2 text-muted">Everything you’ve joined, plus stuff that fits your free time.</p>
        </div>
        <SuggestionsSwitch on={showSuggestions} onToggle={() => setShowSuggestions((on) => !on)} />
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
