import { useEffect, useState } from 'react'
import { deleteEvent, getUser, listEventsByOrganizer } from '../api.jsx'
import Avatar from '../components/Avatar.jsx'
import EventCard from '../components/EventCard.jsx'
import { ErrorMessage, Notice, primaryButton, secondaryButton, smallButton } from '../components/ui.jsx'
import { displayName } from '../utils/format.js'
import { HOME_PATH, NEW_EVENT_PATH, editEventPath } from '../utils/routes.js'
import { showToast } from '../utils/toast.js'

const gridClass = 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'

function ProfileSkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 animate-pulse rounded-full bg-brand-50 motion-reduce:animate-none sm:h-24 sm:w-24" />
        <div className="h-8 w-48 rounded bg-line" />
      </div>
      <div className={gridClass}>
        {[0, 1, 2].map((n) => (
          <div key={n} className="aspect-video animate-pulse rounded-2xl bg-brand-50 motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  )
}

// Edit and Delete buttons under each of your own events. Delete asks first.
function OwnerActions({ event, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteEvent(event.event_id)
      showToast('Event deleted.')
      onDeleted(event.event_id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">Delete this event?</span>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={`${smallButton} border-danger bg-danger-50 text-danger hover:bg-danger-50`}
          >
            {busy ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={smallButton}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <a href={editEventPath(event.event_id)} className={smallButton}>
            <span aria-hidden="true">✏️</span> Edit
          </a>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${event.event_title}`}
            className={smallButton}
          >
            <span aria-hidden="true">🗑️</span> Delete
          </button>
        </div>
      )}
      <ErrorMessage message={error} />
    </div>
  )
}

// A user's profile: picture and name, then the events they posted. Your own
// profile (uid = profile.uid) adds Edit and Delete to each event.
export default function AccountProfile({ uid, profile }) {
  const isOwn = uid === profile.uid
  const [result, setResult] = useState(null)
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Your own row comes from App, so it's already up to date after settings changes.
    Promise.all([isOwn ? null : getUser(uid), listEventsByOrganizer(uid)])
      .then(([user, events]) => !cancelled && setResult({ user, events }))
      .catch((err) => !cancelled && setResult({ error: err.message }))
    return () => {
      cancelled = true
    }
  }, [uid, isOwn, retries])

  if (!result) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading profile…</span>
        <ProfileSkeleton />
      </div>
    )
  }

  if (result.error) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={result.error} />
        <button type="button" onClick={() => setRetries((n) => n + 1)} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  }

  const user = isOwn ? profile : result.user
  if (!user || !user.is_active) {
    return (
      <Notice icon={user ? '👤' : '🔍'} title={user ? 'Deleted account' : 'Profile not found'}>
        <p>{user ? 'This account has been deleted.' : 'This link doesn’t match anyone on Rally.'}</p>
        <a href={HOME_PATH} className={primaryButton}>
          Back to events
        </a>
      </Notice>
    )
  }

  const { events } = result
  const removeEvent = (eventId) =>
    setResult((r) => ({ ...r, events: r.events.filter((event) => event.event_id !== eventId) }))

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        <Avatar user={user} className="h-20 w-20 text-3xl sm:h-24 sm:w-24 sm:text-4xl" />
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{displayName(user)}</h1>
          <p className="mt-1 text-muted">
            {events.length} {events.length === 1 ? 'event' : 'events'} posted
          </p>
        </div>
      </header>

      <section aria-labelledby="profile-events-heading" className="space-y-6">
        <h2 id="profile-events-heading" className="text-2xl font-extrabold tracking-tight text-ink">
          {isOwn ? 'Your events' : 'Events'}
        </h2>
        {events.length === 0 ? (
          <Notice icon="🗓️" title={isOwn ? 'You haven’t posted anything yet' : 'No events yet'}>
            {isOwn ? (
              <>
                <p>Got a study session, game, or club meeting? Put it on the board.</p>
                <a href={NEW_EVENT_PATH} className={primaryButton}>
                  Post an event
                </a>
              </>
            ) : (
              <p>{user.full_name} hasn’t posted any events.</p>
            )}
          </Notice>
        ) : (
          <div className={gridClass}>
            {events.map((event) => (
              <EventCard key={event.event_id} event={event}>
                {isOwn && <OwnerActions event={event} onDeleted={removeEvent} />}
              </EventCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
