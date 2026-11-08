import { useEffect, useId, useRef, useState } from 'react'
import {
  COMMENT_MAX,
  addComment,
  countJoiners,
  findOrCreateChat,
  getEvent,
  hasJoined,
  joinEvent,
  leaveEvent,
  listComments,
} from '../api.jsx'
  listJoiners,
} from '../api.jsx'
import Avatar from '../components/Avatar.jsx'
import EventPicture from '../components/EventPicture.jsx'
import { ErrorMessage, Notice, inputClass, primaryButton, secondaryButton, smallButton } from '../components/ui.jsx'
import { openChat } from '../utils/chat_events.js'
import { displayName, formatEventTime, formatTimestamp } from '../utils/format.js'
import { HOME_PATH, editEventPath, profilePath } from '../utils/routes.js'
import { showToast } from '../utils/toast.js'

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

// How many joiners show before the "See all" button.
const JOINER_PREVIEW = 6

// Popup with everyone who joined, one per row. Uses <dialog> so Escape closes
// it and keyboard focus stays inside while it's open.
function GuestListDialog({ open, onClose, joiners, profile }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog itself (not its contents) is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-brand-900/60"
    >
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
            Who's going <span className="font-semibold text-muted">· {joiners.length}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-muted hover:bg-brand-50 hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <ul className="divide-y divide-line overflow-y-auto px-5">
          {joiners.map((user) => (
            <li key={user.uid} className="flex items-center gap-3 py-3">
              <Avatar user={user} className="h-10 w-10 text-base" />
              <span className="min-w-0 break-words font-semibold">
                <UserName user={user} />
                {user.uid === profile.uid && <span className="font-normal text-muted"> (you)</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}

// The first few people who joined, as name pills linking to their profiles,
// with a button that opens the full list in a popup.
// Reloads whenever `refreshKey` changes (after joining or leaving).
function JoinerList({ eventId, profile, refreshKey }) {
  const [state, setState] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    listJoiners(eventId)
      .then((joiners) => !cancelled && setState({ joiners }))
      .catch((err) => !cancelled && setState({ error: err.message }))
    return () => {
      cancelled = true
    }
  }, [eventId, refreshKey])

  let body
  if (!state) body = <p className="text-sm text-muted">Loading…</p>
  else if (state.error) body = <ErrorMessage message={state.error} />
  else if (state.joiners.length === 0) body = <p className="text-sm text-muted">No one yet. Be the first!</p>
  else {
    const { joiners } = state
    const hidden = joiners.length - JOINER_PREVIEW
    body = (
      <>
        <ul className="flex flex-wrap gap-2">
          {joiners.slice(0, JOINER_PREVIEW).map((user) => (
            <li
              key={user.uid}
              className="flex max-w-full items-center gap-2 rounded-full border border-line bg-page py-1 pl-1 pr-3 text-sm font-semibold"
            >
              <Avatar user={user} className="h-6 w-6 text-xs" />
              <span className="min-w-0 break-words">
                <UserName user={user} />
                {user.uid === profile.uid && <span className="font-normal text-muted"> (you)</span>}
              </span>
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <>
            <button type="button" onClick={() => setShowAll(true)} aria-haspopup="dialog" className={smallButton}>
              See all {joiners.length} going
            </button>
            <GuestListDialog open={showAll} onClose={() => setShowAll(false)} joiners={joiners} profile={profile} />
          </>
        )}
      </>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Who's going</p>
      {body}
    </div>
  )
}

function JoinButton({ eventId, profile, initialCount, initialJoined, onChange }) {
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
      showToast(next ? 'You’re in! See you there.' : 'You left this event.')
      onChange?.()
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
      showToast(replyingTo ? 'Reply posted.' : 'Comment posted.')
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
  const [dmBusy, setDmBusy] = useState(false)
  const [dmError, setDmError] = useState('')
  const [dmNote, setDmNote] = useState(false)
  const [joinChanges, setJoinChanges] = useState(0)

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

  const handleMessageOrganizer = async () => {
    setDmBusy(true)
    setDmError('')
    try {
      const chatId = await findOrCreateChat({ uid: profile.uid, otherUid: event.organizer_uid, chatName: event.event_title })
      openChat(chatId)
    } catch (err) {
      setDmError(err.message)
    } finally {
      setDmBusy(false)
    }
  }

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
          <JoinButton
            eventId={event.event_id}
            profile={profile}
            initialCount={result.joinCount}
            initialJoined={result.joined}
            onChange={() => setJoinChanges((n) => n + 1)}
          />
          <JoinerList eventId={event.event_id} profile={profile} refreshKey={joinChanges} />
          {!isOrganizer && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleMessageOrganizer}
                disabled={!organizerActive || dmBusy}
                className={`${secondaryButton} w-full`}
              >
                <span aria-hidden="true">💬</span> Message organizer
              </button>
              <ErrorMessage message={dmError} />
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
