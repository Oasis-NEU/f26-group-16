import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHAT_NAME_MAX, MESSAGE_MAX, getChat, listChats, listMessages, renameChat, sendMessage } from '../api.jsx'
import { OPEN_CHAT_EVENT } from '../utils/chat_events.js'
import { chatTitle, defaultChatTitle, displayName, formatTimestamp } from '../utils/format.js'
import { eventPath } from '../utils/routes.js'
import { useDismiss } from '../utils/use_dismiss.js'
import { usePolling } from '../utils/use_polling.js'
import { ConnectionBanner, ErrorMessage, PopupNote, inputClass, popupPanelClass } from './ui.jsx'
import UserName from './UserName.jsx'

const POLL_MS = 2000

// Direct chats and event group chats (`event_id` set) come in one list.
function ChatList({ profile, onSelect }) {
  const load = useCallback(() => listChats(profile.uid), [profile.uid])
  const { data: chats, failed } = usePolling(load, POLL_MS)

  // "You: …" for your own message; in a group, the sender's name.
  const senderPrefix = (chat) => {
    if (chat.latest.sender_uid === profile.uid) return 'You: '
    return chat.event_id ? `${displayName(chat.latest.sender)}: ` : ''
  }

  return (
    <>
      <h2 className="border-b border-line px-5 py-4 font-bold text-ink">Messages</h2>
      <ConnectionBanner show={failed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats === null && !failed && <PopupNote>Loading…</PopupNote>}
        {chats?.length === 0 && (
          <PopupNote>No messages yet. Message an organizer, or open the group chat of an event you joined.</PopupNote>
        )}
        {chats?.length > 0 && (
          <ul className="divide-y divide-line">
            {chats.map((chat) => (
              <li key={chat.chat_id}>
                <button type="button" onClick={() => onSelect(chat.chat_id)} className="w-full px-5 py-3 text-left hover:bg-brand-50">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold text-ink">
                      {chat.event_id && <span aria-hidden="true">👥 </span>}
                      {chatTitle(chat)}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatTimestamp(chat.latest.msg_time)}</span>
                  </span>
                  {/* A labeled chat names the person or event under the label. An
                      unlabeled direct chat is already titled with the person's name. */}
                  {(chat.event_id || chat.chat_name) && (
                    <span className="block truncate text-xs text-muted">
                      {chat.event_id
                        ? `Group chat${chat.chat_name ? ` · ${defaultChatTitle(chat)}` : ''}`
                        : displayName(chat.other)}
                    </span>
                  )}
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {senderPrefix(chat)}
                    {chat.latest.msg_content}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// `showSenders` puts the sender's name over other people's messages (group chats).
function MessageList({ messages, uid, showSenders = false }) {
  const listRef = useRef(null)
  // Follow new messages, unless the user has scrolled up to read older ones.
  const followRef = useRef(true)
  const lastId = messages.at(-1)?.msg_id

  useLayoutEffect(() => {
    if (followRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [lastId])

  const handleScroll = () => {
    const list = listRef.current
    followRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40
  }

  return (
    <div ref={listRef} onScroll={handleScroll} role="log" aria-label="Messages" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.length === 0 && <p className="py-4 text-center text-sm text-muted">Say hello to start the conversation.</p>}
      {messages.map((message) => {
        const mine = message.sender_uid === uid
        return (
          <div key={message.msg_id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
            {showSenders && !mine && (
              <span className="mb-1 text-xs font-semibold text-muted">{displayName(message.sender)}</span>
            )}
            <p
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                mine ? 'bg-brand-500 text-white' : 'bg-brand-100 text-ink'
              }`}
            >
              {message.msg_content}
            </p>
            <span className="mt-1 text-xs text-muted">{formatTimestamp(message.msg_time)}</span>
          </div>
        )
      })}
    </div>
  )
}

function MessageForm({ chatId, uid, onSent }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await sendMessage({ chatId, senderUid: uid, content: text })
      setText('')
      onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t border-line p-3">
      <ErrorMessage message={error} />
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MESSAGE_MAX}
          aria-label="Message"
          placeholder="Write a message…"
          autoFocus
          className={`${inputClass} min-w-0 py-2`}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </form>
  )
}

const headerIconButton =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm disabled:cursor-not-allowed disabled:opacity-60'

// The open chat's title with a ✏️ button to relabel it. Whatever names the
// person or event (their name, the event title) links to their profile or the
// event page. Unlabeled, that name is the title: a direct chat has no line under
// it, a group chat has "Group chat". Labeled, the label is the title and the
// name moves under it ("Group chat · <event>" for groups).
function ChatHeading({ chat, onLeave, onEdit, editButtonRef }) {
  const isGroup = Boolean(chat.event_id)
  let title = chatTitle(chat)
  let subtitle = null
  if (isGroup) {
    const eventLink = (
      <a href={eventPath(chat.event_id)} onClick={onLeave} className="hover:underline">
        {defaultChatTitle(chat)}
      </a>
    )
    title = (
      <>
        <span aria-hidden="true">👥 </span>
        {chat.chat_name || eventLink}
      </>
    )
    subtitle = (
      <p className="truncate text-xs text-muted">
        Group chat
        {chat.chat_name && (
          <>
            {' · '}
            <span className="text-ink">{eventLink}</span>
          </>
        )}
      </p>
    )
  } else if (!chat.chat_name) {
    title = <UserName user={chat.other} onClick={onLeave} />
  } else {
    subtitle = (
      <p className="truncate text-xs">
        <UserName user={chat.other} onClick={onLeave} />
      </p>
    )
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="min-w-0 truncate font-bold text-ink">{title}</h2>
        <button
          ref={editButtonRef}
          type="button"
          onClick={onEdit}
          aria-label="Rename chat"
          title="Rename chat (only you see this)"
          className={`${headerIconButton} text-muted hover:bg-brand-50`}
        >
          <span aria-hidden="true">✏️</span>
        </button>
      </div>
      {subtitle}
    </div>
  )
}

// Text field for the user's own label, with save (✓) and cancel (✕). Saving a
// blank field clears the label, so the chat goes back to its default name
// (shown as the placeholder). Escape cancels without closing the popup.
// `onDone(saved)` closes the editor.
function ChatNameEditor({ chat, uid, onDone }) {
  const [name, setName] = useState(chat.chat_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await renameChat({ chatId: chat.chat_id, uid, chatName: name })
      await onDone(true)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return
    // Keep the popup's own Escape handler (useDismiss) from closing it.
    event.stopPropagation()
    if (!busy) onDone(false)
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="min-w-0 flex-1 space-y-2">
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={CHAT_NAME_MAX}
          aria-label="Chat name"
          placeholder={defaultChatTitle(chat)}
          autoFocus
          onFocus={(event) => event.target.select()}
          className={`${inputClass} min-w-0 px-3 py-1.5 text-sm`}
        />
        <button
          type="submit"
          disabled={busy}
          aria-label="Save chat name"
          className={`${headerIconButton} border border-line bg-surface font-bold text-success hover:bg-success-50`}
        >
          <span aria-hidden="true">✓</span>
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          disabled={busy}
          aria-label="Cancel renaming"
          className={`${headerIconButton} border border-line bg-surface font-bold text-danger hover:bg-danger-50`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <ErrorMessage message={error} />
    </form>
  )
}

// One chat. A direct chat shows the other person (`onLeave` closes the popup
// when their name opens their profile). A group chat links its title to the
// event and shows who sent each message; leaving the event removes you, so the
// chat then shows a note instead.
function ChatView({ chatId, uid, onBack, onLeave }) {
  const load = useCallback(async () => {
    const [chat, messages] = await Promise.all([getChat(chatId, uid), listMessages(chatId)])
    return { chat, messages }
  }, [chatId, uid])
  const { data, failed, refresh } = usePolling(load, POLL_MS)
  const chat = data?.chat
  const isGroup = Boolean(chat?.event_id)
  const [editing, setEditing] = useState(false)
  const editButtonRef = useRef(null)

  // After a save, wait for the new name to load so the old one doesn't flash
  // back. Focus returns to the edit button either way.
  const finishEditing = async (saved) => {
    if (saved) await refresh()
    setEditing(false)
    requestAnimationFrame(() => editButtonRef.current?.focus())
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-brand-50"
        >
          <span aria-hidden="true">←</span>
        </button>
        {chat &&
          (editing ? (
            <ChatNameEditor chat={chat} uid={uid} onDone={finishEditing} />
          ) : (
            <ChatHeading chat={chat} onLeave={onLeave} onEdit={() => setEditing(true)} editButtonRef={editButtonRef} />
          ))}
      </div>
      <ConnectionBanner show={failed} />
      {!data && <div className="flex-1">{!failed && <PopupNote>Loading…</PopupNote>}</div>}
      {data && !chat && <PopupNote>This chat isn’t available. Group chats are only for the organizer and people who joined.</PopupNote>}
      {chat && <MessageList messages={data.messages} uid={uid} showSenders={isGroup} />}
      {chat &&
        (isGroup || chat.other?.is_active ? (
          <MessageForm chatId={chatId} uid={uid} onSent={refresh} />
        ) : (
          <p className="border-t border-line px-4 py-3 text-center text-sm text-muted">You can’t reply to a deleted account.</p>
        ))}
    </>
  )
}

// Menu bar button and its popup: the chat list, or one open chat (direct or
// group). Polling only runs while the popup is open.
export default function MessagesPopup({ profile }) {
  const [open, setOpen] = useState(false)
  const [chatId, setChatId] = useState(null)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)

  useEffect(() => {
    const onOpenChat = (event) => {
      setChatId(event.detail)
      setOpen(true)
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpenChat)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpenChat)
  }, [])

  return (
    <div ref={ref} className="lg:relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Messages"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-lg hover:bg-brand-50"
      >
        <span aria-hidden="true">💬</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Messages" className={popupPanelClass}>
          {chatId ? (
            <ChatView key={chatId} chatId={chatId} uid={profile.uid} onBack={() => setChatId(null)} onLeave={() => setOpen(false)} />
          ) : (
            <ChatList profile={profile} onSelect={setChatId} />
          )}
        </div>
      )}
    </div>
  )
}
