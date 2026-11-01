import { useEffect, useId, useState } from 'react'
import { COMMENT_MAX, addComment, countJoiners, getEvent, hasJoined, joinEvent, leaveEvent, listComments } from '../api.jsx'
import EventPicture from '../components/EventPicture.jsx'
import { ErrorMessage, Notice, inputClass, primaryButton, secondaryButton, smallButton } from '../components/ui.jsx'
import { displayName, formatEventTime, formatTimestamp } from '../utils/format.js'
import { HOME_PATH, editEventPath, profilePath } from '../utils/routes.js'

// Links to the user's profile, or plain text for deleted accounts.
function UserName({ user, className = '' }) {
  if (!user?.is_active) return <span className={`text-muted ${className}`}>{displayName(user)}</span>
  return (
    <a href={profilePath(user.uid)} className={`text-ink hover:text-brand-600 hover:underline ${className}`}>
      {user.full_name}
    </a>
  )
}

function InfoRow({ icon, label, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <div className="break-words font-semibold text-ink">{children}</div>
      </div>
    </div>
  )
}

function JoinButton({ eventId, profile, initialCount, initialJoined }) {
  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Updates right away, then rolls back if the request fails.
  const toggle = async () => {
    const next = !joined
    setError('')
    setBusy(true)
    setJoined(next)
    setCount((c) => c + (next ? 1 : -1))
    try {
      await (next ? joinEvent(eventId, profile.uid) : leaveEvent(eventId, profile.uid))
    } catch (err) {
      setJoined(!next)
      setCount((c) => c - (next ? 1 : -1))
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted" aria-live="polite">
        <span className="text-2xl font-extrabold text-ink">{count}</span> {count === 1 ? 'person' : 'people'} joined
        {joined && <span className="font-semibold text-brand-600"> · including you</span>}
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={joined}
        className={`${joined ? secondaryButton : primaryButton} w-full`}
      >
        {joined ? 'Leave event' : 'Join event'}
      </button>
      <ErrorMessage message={error} />
    </div>
  )
}

function CommentForm({ eventId, profile, replyingTo, onPosted, onCancel }) {
  const id = useId()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const comment = await addComment({ eventId, senderUid: profile.uid, content: text, replyingTo })
      setText('')
      onPosted(comment)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const label = replyingTo ? 'Write a reply' : 'Write a comment'
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={replyingTo ? 2 : 3}
        maxLength={COMMENT_MAX}
        placeholder={replyingTo ? 'Write a reply…' : 'Ask a question or say you’re coming…'}
        autoFocus={Boolean(replyingTo)}
        className={`${inputClass} resize-y`}
      />
      <ErrorMessage message={error} />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={smallButton}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Posting…' : replyingTo ? 'Reply' : 'Post comment'}
        </button>
      </div>
    </form>
  )
}

function Comment({ comment, onReply }) {
  const initial = comment.sender?.is_active ? comment.sender.full_name.trim()[0]?.toUpperCase() : '?'
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600" aria-hidden="true">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <UserName user={comment.sender} className="font-semibold" />
          <span className="text-muted"> · {formatTimestamp(comment.comment_time)}</span>
        </p>
        <p className="mt-1 whitespace-pre-line break-words text-ink">{comment.comment_content}</p>
        <button type="button" onClick={onReply} className="mt-1 text-sm font-semibold text-brand-600 hover:underline">
          Reply
        </button>
      </div>
    </div>
  )
}

function Comments({ eventId, profile }) {
  const [result, setResult] = useState(null)
  const [retries, setRetries] = useState(0)
  // The main comment whose reply form is open.
  const [replyTo, setReplyTo] = useState(null)

  useEffect(() => {
    let cancelled = false
    listComments(eventId)
      .then((comments) => !cancelled && setResult({ comments }))
      .catch((err) => !cancelled && setResult({ error: err.message }))
    return () => {
      cancelled = true
    }
  }, [eventId, retries])

  const addLocal = (comment) => {
    setResult((r) => ({ comments: [...r.comments, comment] }))
    setReplyTo(null)
  }

  const comments = result?.comments ?? []
  const threads = comments
    .filter((c) => !c.replying_to)
    .map((main) => ({ main, replies: comments.filter((c) => c.replying_to === main.comment_id) }))

  return (
    <section aria-labelledby="comments-heading" className="space-y-6">
      <h2 id="comments-heading" className="text-2xl font-extrabold tracking-tight text-ink">
        Comments{result?.comments && <span className="text-muted"> ({comments.length})</span>}
      </h2>
      <CommentForm eventId={eventId} profile={profile} replyingTo={null} onPosted={addLocal} />
      {!result && <p className="text-muted">Loading comments…</p>}
      {result?.error && (
        <div className="space-y-3">
          <ErrorMessage message={result.error} />
          <button type="button" onClick={() => setRetries((n) => n + 1)} className={smallButton}>
            Try again
          </button>
        </div>
      )}
      {result?.comments && threads.length === 0 && <p className="text-muted">No comments yet. Start the conversation!</p>}
      {threads.length > 0 && (
        <ul className="space-y-6">
          {threads.map(({ main, replies }) => (
            <li key={main.comment_id} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <Comment comment={main} onReply={() => setReplyTo(main.comment_id)} />
              {(replies.length > 0 || replyTo === main.comment_id) && (
                <div className="space-y-4 border-l-2 border-brand-100 pl-4 sm:ml-12">
                  {replies.map((reply) => (
                    // Replying to a reply continues the main comment's thread.
                    <Comment key={reply.comment_id} comment={reply} onReply={() => setReplyTo(main.comment_id)} />
                  ))}
                  {replyTo === main.comment_id && (
                    <CommentForm
                      eventId={eventId}
                      profile={profile}
                      replyingTo={main.comment_id}
                      onPosted={addLocal}
                      onCancel={() => setReplyTo(null)}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="h-5 w-24 rounded bg-line" />
      <div className="aspect-video w-full animate-pulse rounded-2xl bg-brand-50 motion-reduce:animate-none" />
      <div className="h-8 w-2/3 rounded bg-line" />
    </div>
  )
}

const backLink = (
  <a href={HOME_PATH} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
    <span aria-hidden="true">←</span> All events
  </a>
)

export default function EventDetail({ eventId, profile }) {
  const [result, setResult] = useState(null)
  const [retries, setRetries] = useState(0)
  const [dmNote, setDmNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getEvent(eventId), countJoiners(eventId), hasJoined(eventId, profile.uid)])
      .then(([event, joinCount, joined]) => !cancelled && setResult({ event, joinCount, joined }))
      .catch((err) => !cancelled && setResult({ error: err.message }))
    return () => {
      cancelled = true
    }
  }, [eventId, profile.uid, retries])

  if (!result) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading event…</span>
        <DetailSkeleton />
      </div>
    )
  }

  if (result.error) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorMessage message={result.error} />
        <button type="button" onClick={() => setRetries((n) => n + 1)} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  }

  const { event } = result
  if (!event) {
    return (
      <Notice icon="🔍" title="Event not found">
        <p>It may have been deleted by its organizer.</p>
        <a href={HOME_PATH} className={primaryButton}>
          Back to events
        </a>
      </Notice>
    )
  }

  const isOrganizer = event.organizer_uid === profile.uid
  const organizerActive = Boolean(event.organizer?.is_active)

  return (
    <article className="space-y-6">
      {backLink}
      <EventPicture event={event} className="aspect-video max-h-[28rem] rounded-2xl" glyphClass="text-7xl sm:text-8xl" />
      <header className="space-y-3">
        {event.category && (
          <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-600">
            {event.category.name}
          </span>
        )}
        <h1 className="break-words text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{event.event_title}</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* First in the DOM so phones see when/where and the join button before the comments. */}
        <aside className="space-y-6 self-start rounded-2xl border border-line bg-surface p-6 shadow-sm lg:sticky lg:top-24 lg:col-start-3 lg:row-start-1">
          <div className="space-y-4">
            <InfoRow icon="🗓️" label="When">
              {formatEventTime(event.start_time, event.end_time)}
            </InfoRow>
            <InfoRow icon="📍" label="Where">
              {event.location || <span className="font-normal text-muted">Location to be announced</span>}
            </InfoRow>
            <InfoRow icon="👤" label="Organizer">
              <UserName user={event.organizer} />
              {isOrganizer && <span className="font-normal text-muted"> (you)</span>}
            </InfoRow>
          </div>
          <JoinButton eventId={event.event_id} profile={profile} initialCount={result.joinCount} initialJoined={result.joined} />
          {!isOrganizer && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setDmNote(true)}
                disabled={!organizerActive}
                className={`${secondaryButton} w-full`}
              >
                <span aria-hidden="true">💬</span> Message organizer
              </button>
              {dmNote && (
                <p role="status" className="text-center text-sm text-muted">
                  Direct messages are coming soon.
                </p>
              )}
            </div>
          )}
          {isOrganizer && (
            <a href={editEventPath(event.event_id)} className={`${secondaryButton} w-full`}>
              <span aria-hidden="true">✏️</span> Edit event
            </a>
          )}
        </aside>

        <div className="min-w-0 space-y-10 lg:col-span-2 lg:row-start-1">
          <section aria-labelledby="about-heading" className="space-y-3">
            <h2 id="about-heading" className="text-2xl font-extrabold tracking-tight text-ink">
              About this event
            </h2>
            {event.event_description ? (
              <p className="whitespace-pre-line break-words leading-relaxed text-muted">{event.event_description}</p>
            ) : (
              <p className="text-muted">The organizer hasn’t added a description yet.</p>
            )}
          </section>
          <Comments eventId={event.event_id} profile={profile} />
        </div>
      </div>
    </article>
  )
}
