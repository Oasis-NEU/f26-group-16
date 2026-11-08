import { useEffect, useId, useState } from 'react'
import {
  DESCRIPTION_MAX,
  LOCATION_MAX,
  TITLE_MAX,
  createEvent,
  fileToDataUrl,
  getEvent,
  listCategories,
  updateEvent,
} from '../api.jsx'
import { ErrorMessage, Notice, inputClass, primaryButton, secondaryButton, smallButton } from '../components/ui.jsx'
import { categoryEmoji, fromDateTimeInput, toDateTimeInput } from '../utils/format.js'
import { HOME_PATH, eventPath, navigate } from '../utils/routes.js'
import { showToast } from '../utils/toast.js'

function Field({ id, label, optional, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function PictureField({ picture, categoryId, onChange }) {
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')

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
      <p className="text-xs text-muted">Any image works. It’s resized to fit 1920×1080 and saved as WebP.</p>
      <ErrorMessage message={error} />
    </div>
  )
}

// `event` is null when posting a new event.
function EventForm({ categories, event, profile }) {
  const ids = useId()
  const [title, setTitle] = useState(event?.event_title ?? '')
  const [categoryId, setCategoryId] = useState(event?.category_id ?? '')
  const [start, setStart] = useState(toDateTimeInput(event?.start_time))
  const [end, setEnd] = useState(toDateTimeInput(event?.end_time))
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.event_description ?? '')
  const [picture, setPicture] = useState(event?.picture_data ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const fields = {
      title,
      description,
      location,
      startTime: fromDateTimeInput(start),
      endTime: fromDateTimeInput(end),
      categoryId: categoryId || null,
      pictureData: picture,
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
          placeholder="Sunset doubles at the courts"
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
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={`${ids}-start`} label="Starts">
          <input
            id={`${ids}-start`}
            type="datetime-local"
            value={start}
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
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
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
          className={`${inputClass} resize-y`}
        />
      </Field>
      <PictureField picture={picture} categoryId={categoryId} onChange={setPicture} />
      <ErrorMessage message={error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a href={event ? eventPath(event.event_id) : HOME_PATH} className={secondaryButton}>
          Cancel
        </a>
        <button type="submit" disabled={busy} className={primaryButton}>
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
