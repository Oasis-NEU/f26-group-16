import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MESSAGE_MAX, getChat, listChats, listMessages, sendMessage } from '../api.jsx'
import { OPEN_CHAT_EVENT } from '../utils/chat_events.js'
import { displayName, formatTimestamp } from '../utils/format.js'
import { useDismiss } from '../utils/use_dismiss.js'
import { usePolling } from '../utils/use_polling.js'
import { ConnectionBanner, ErrorMessage, PopupNote, inputClass, popupPanelClass } from './ui.jsx'

const POLL_MS = 2000

function ChatList({ profile, onSelect }) {
  const load = useCallback(() => listChats(profile.uid), [profile.uid])
  const { data: chats, failed } = usePolling(load, POLL_MS)

  return (
    <>
      <h2 className="border-b border-line px-5 py-4 font-bold text-ink">Direct messages</h2>
      <ConnectionBanner show={failed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats === null && !failed && <PopupNote>Loading…</PopupNote>}
        {chats?.length === 0 && <PopupNote>No messages yet. Open an event and message its organizer to start a chat.</PopupNote>}
        {chats?.length > 0 && (
          <ul className="divide-y divide-line">
            {chats.map((chat) => (
              <li key={chat.chat_id}>
                <button type="button" onClick={() => onSelect(chat.chat_id)} className="w-full px-5 py-3 text-left hover:bg-brand-50">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold text-ink">{chat.chat_name}</span>
                    {chat.latest && <span className="shrink-0 text-xs text-muted">{formatTimestamp(chat.latest.msg_time)}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{displayName(chat.other)}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {chat.latest
                      ? `${chat.latest.sender_uid === profile.uid ? 'You: ' : ''}${chat.latest.msg_content}`
                      : 'No messages yet'}
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

function MessageList({ messages, uid }) {
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

function ChatView({ chatId, uid, onBack }) {
  const load = useCallback(async () => {
    const [chat, messages] = await Promise.all([getChat(chatId, uid), listMessages(chatId)])
    return { chat, messages }
  }, [chatId, uid])
  const { data, failed, refresh } = usePolling(load, POLL_MS)
  const chat = data?.chat

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
        {chat && (
          <div className="min-w-0">
            <h2 className="truncate font-bold text-ink">{chat.chat_name}</h2>
            <p className="truncate text-xs text-muted">{displayName(chat.other)}</p>
          </div>
        )}
      </div>
      <ConnectionBanner show={failed} />
      {!data && <div className="flex-1">{!failed && <PopupNote>Loading…</PopupNote>}</div>}
      {data && !chat && <PopupNote>This chat isn’t available.</PopupNote>}
      {chat && <MessageList messages={data.messages} uid={uid} />}
      {chat &&
        (chat.other?.is_active ? (
          <MessageForm chatId={chatId} uid={uid} onSent={refresh} />
        ) : (
          <p className="border-t border-line px-4 py-3 text-center text-sm text-muted">You can’t reply to a deleted account.</p>
        ))}
    </>
  )
}

// Menu bar button and its popup: the chat list, or one open chat. Polling only
// runs while the popup is open.
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
        aria-label="Direct messages"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-lg hover:bg-brand-50"
      >
        <span aria-hidden="true">💬</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Direct messages" className={popupPanelClass}>
          {chatId ? (
            <ChatView key={chatId} chatId={chatId} uid={profile.uid} onBack={() => setChatId(null)} />
          ) : (
            <ChatList profile={profile} onSelect={setChatId} />
          )}
        </div>
      )}
    </div>
  )
}
