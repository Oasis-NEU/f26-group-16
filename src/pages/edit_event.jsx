import { useEffect, useId, useState } from 'react'
import {
  CAPACITY_MIN,
  DESCRIPTION_MAX,
  LOCATION_MAX,
  TITLE_MAX,
  capacityBelowJoinedMessage,
  createEvent,
  fileToDataUrl,
  getEvent,
  listCategories,
  updateEvent,
} from '../api.jsx'
import { ErrorMessage, Notice, inputClass, primaryButton, secondaryButton, smallButton } from '../components/ui.jsx'
import { joinedCount } from '../utils/capacity.js'
import {
  allDayInputs,
  categoryEmoji,
  endOfDay,
  fromDateTimeInput,
  startOfDay,
  timeZoneLabel,
  toDateInput,
  toDateTimeInput,
} from '../utils/format.js'
import { HOME_PATH, eventPath, navigate } from '../utils/routes.js'
import { showToast } from '../utils/toast.js'
import { useCategoryPicture } from '../utils/use_category_picture.js'

// `warning` shows in red under the field, in place of the hint.
function Field({ id, label, optional, hint, warning, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {warning ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {warning}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

// The headcount input holds a string; empty means no limit.
const parseHeadcount = (value) => (value.trim() === '' ? null : Number(value))

function PictureField({ picture, categoryId, onChange }) {
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')
  const categoryPicture = useCategoryPicture(categoryId)

  const pick = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setConverting(true)
    try {
      onChange(await fileToDataUrl(file))
    } catch (err) {
      setError(err.message)
    }
    setConverting(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">
        Cover picture <span className="font-normal text-muted">(optional)</span>
      </p>
      {picture ? (
        <img src={picture} alt="Cover picture preview" className="aspect-video w-full rounded-xl border border-line object-cover" />
      ) : categoryPicture ? (
        <div className="relative">
          <img src={categoryPicture} alt="Category picture preview" className="aspect-video w-full rounded-xl border border-line object-cover" />
          <span className="absolute bottom-2 left-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-sm">
            Category picture, used until you add one
          </span>
        </div>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-brand-50">
          <span className="text-5xl" aria-hidden="true">
            {categoryEmoji(categoryId)}
          </span>
          <span className="text-sm text-muted">No picture yet</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${smallButton} cursor-pointer focus-within:ring-2 focus-within:ring-brand-500`}>
          {converting ? 'Converting…' : picture ? 'Change picture' : 'Upload picture'}
          <input type="file" accept="image/*" onChange={pick} disabled={converting} className="sr-only" />
        </label>
        {picture && !converting && (
          <button type="button" onClick={() => onChange(null)} className={smallButton}>
            Remove
          </button>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  )
}

// `event` is null when posting a new event.
function EventForm({ categories, event, profile }) {
  const ids = useId()
  const [title, setTitle] = useState(event?.event_title ?? '')
  const [categoryId, setCategoryId] = useState(event?.category_id ?? '')
  // Timed events use the date-and-time fields; all-day events the day fields.
  // Both are kept, so switching back and forth doesn't lose what was typed.
  const wasAllDay = Boolean(event?.all_day)
  const [allDay, setAllDay] = useState(wasAllDay)
  const [start, setStart] = useState(wasAllDay ? '' : toDateTimeInput(event?.start_time))
  const [end, setEnd] = useState(wasAllDay ? '' : toDateTimeInput(event?.end_time))
  // The days the event was saved with, as this browser reads them.
  const [savedDays] = useState(() =>
    wasAllDay ? allDayInputs(event.start_time, event.end_time) : { firstDay: '', lastDay: '' },
  )
  const [firstDay, setFirstDay] = useState(savedDays.firstDay)
  const [lastDay, setLastDay] = useState(savedDays.lastDay === savedDays.firstDay ? '' : savedDays.lastDay)
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.event_description ?? '')
  const [picture, setPicture] = useState(event?.picture_data ?? null)
  const [headcount, setHeadcount] = useState(event?.max_participants?.toString() ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // When editing, warn as soon as the limit is below the people already in.
  const joined = event ? joinedCount(event) : 0
  const limit = parseHeadcount(headcount)
  const headcountWarning = limit != null && limit < joined ? capacityBelowJoinedMessage(joined) : ''

  // New events can't start in the past (api.jsx checks this too, with a
  // clearer message for edits). The browser blocks earlier picks up front.
  // Set when the form opens.
  const [{ nowInput, todayInput }] = useState(() =>
    event
      ? {}
      : { nowInput: toDateTimeInput(Math.floor(Date.now() / 1000)), todayInput: toDateInput(new Date()) },
  )

  const toggleAllDay = (on) => {
    setAllDay(on)
    // Carry the dates over the first time each set of fields is used.
    if (on && !firstDay && start) {
      setFirstDay(start.slice(0, 10))
      if (end && end.slice(0, 10) !== start.slice(0, 10)) setLastDay(end.slice(0, 10))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    // All day: local midnight of the first day to 23:59:59 of the last. If the
    // days weren't touched, keep the saved times, so editing from another time
    // zone doesn't move the event.
    const daysUnchanged =
      wasAllDay && allDay && firstDay === savedDays.firstDay && (lastDay || firstDay) === savedDays.lastDay
    const fields = {
      title,
      description,
      location,
      startTime: daysUnchanged ? event.start_time : allDay ? startOfDay(firstDay) : fromDateTimeInput(start),
      endTime: daysUnchanged ? event.end_time : allDay ? endOfDay(lastDay || firstDay) : fromDateTimeInput(end),
      allDay,
      categoryId: categoryId || null,
      pictureData: picture,
      maxParticipants: limit,
    }
    try {
      const saved = event
        ? await updateEvent(event.event_id, fields)
        : await createEvent({ ...fields, organizerUid: profile.uid })
      navigate(eventPath(saved.event_id))
      showToast(event ? 'Changes saved.' : 'Event posted!')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <Field id={`${ids}-title`} label="Title" hint={`${title.length}/${TITLE_MAX}`}>
        <input
          id={`${ids}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="Study session at Snell Library"
          required
          className={inputClass}
        />
      </Field>
      <Field id={`${ids}-category`} label="Category" optional>
        <select id={`${ids}-category`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => toggleAllDay(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-brand-500"
          />
          All day
        </label>
        {allDay ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id={`${ids}-first-day`} label="Day">
              <input
                id={`${ids}-first-day`}
                type="date"
                value={firstDay}
                min={todayInput}
                onChange={(e) => setFirstDay(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field id={`${ids}-last-day`} label="Last day" optional hint="For events that run over several days.">
              <input
                id={`${ids}-last-day`}
                type="date"
                value={lastDay}
                min={firstDay || todayInput}
                onChange={(e) => setLastDay(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id={`${ids}-start`} label="Starts" hint={`In your time zone (${timeZoneLabel()}).`}>
              <input
                id={`${ids}-start`}
                type="datetime-local"
                value={start}
                min={nowInput}
                onChange={(e) => setStart(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field id={`${ids}-end`} label="Ends" optional>
              <input
                id={`${ids}-end`}
                type="datetime-local"
                value={end}
                min={start || nowInput}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </div>
      <Field
        id={`${ids}-headcount`}
        label="How many people?"
        optional
        hint={
          event && joined > 0
            ? `${joined} joined so far. Leave empty for no limit.`
            : `Leave empty for no limit. At least ${CAPACITY_MIN}.`
        }
        warning={headcountWarning}
      >
        <input
          id={`${ids}-headcount`}
          type="number"
          inputMode="numeric"
          min={CAPACITY_MIN}
          step={1}
          value={headcount}
          onChange={(e) => setHeadcount(e.target.value)}
          placeholder="No limit"
          aria-invalid={Boolean(headcountWarning)}
          className={`${inputClass} sm:max-w-48`}
        />
      </Field>
      <Field id={`${ids}-location`} label="Location" optional>
        <input
          id={`${ids}-location`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={LOCATION_MAX}
          placeholder="Student Center, Room 201"
          className={inputClass}
        />
      </Field>
      <Field id={`${ids}-description`} label="Description" optional hint={`${description.length}/${DESCRIPTION_MAX}`}>
        <textarea
          id={`${ids}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={6}
          placeholder="What should people know? What should they bring?"
          className={`${inputClass} max-h-96 min-h-32 resize-y`}
        />
      </Field>
      <PictureField picture={picture} categoryId={categoryId} onChange={setPicture} />
      <ErrorMessage message={error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a href={event ? eventPath(event.event_id) : HOME_PATH} className={secondaryButton}>
          Cancel
        </a>
        <button type="submit" disabled={busy || Boolean(headcountWarning)} className={primaryButton}>
          {busy ? 'Saving…' : event ? 'Save changes' : 'Post event'}
        </button>
      </div>
    </form>
  )
}

// Posts a new event when `eventId` is null; otherwise edits that event.
export default function EditEvent({ eventId, profile }) {
  const [result, setResult] = useState(null)
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([listCategories(), eventId ? getEvent(eventId) : null])
      .then(([categories, event]) => !cancelled && setResult({ categories, event }))
      .catch((err) => !cancelled && setResult({ error: err.message }))
    return () => {
      cancelled = true
    }
  }, [eventId, retries])

  let body
  if (!result) {
    body = <p className="text-muted">Loading…</p>
  } else if (result.error) {
    body = (
      <div className="space-y-4">
        <ErrorMessage message={result.error} />
        <button type="button" onClick={() => setRetries((n) => n + 1)} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  } else if (eventId && !result.event) {
    body = (
      <Notice icon="🔍" title="Event not found">
        <p>It may have been deleted.</p>
        <a href={HOME_PATH} className={primaryButton}>
          Back to events
        </a>
      </Notice>
    )
  } else if (eventId && result.event.organizer_uid !== profile.uid) {
    body = (
      <Notice icon="🔒" title="Only the organizer can edit this">
        <a href={eventPath(eventId)} className={primaryButton}>
          Back to the event
        </a>
      </Notice>
    )
  } else {
    body = <EventForm categories={result.categories} event={result.event} profile={profile} />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <a
        href={eventId ? eventPath(eventId) : HOME_PATH}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
      >
        <span aria-hidden="true">←</span> {eventId ? 'Back to event' : 'All events'}
      </a>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{eventId ? 'Edit event' : 'Post an event'}</h1>
      {body}
    </div>
  )
}
