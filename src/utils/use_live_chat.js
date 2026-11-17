import { useEffect, useState } from 'react'
import { subscribeToMessages } from '../api.jsx'
import { usePolling } from './use_polling.js'

// While Realtime is down (or still connecting), poll like before.
const POLL_MS = 2000
// While it's up, new messages arrive live. This slow poll still picks up what
// Realtime doesn't send: renamed chats, joining/leaving event chats, deleted
// accounts, changed event titles, and chats read on another device.
const LIVE_POLL_MS = 30000

// usePolling() for chat data that also re-fetches as soon as a new message
// arrives through Realtime: in `chatId`, or in any of the user's chats when
// it's null. `pollMs` is the interval while Realtime is down. `load` must be
// stable (useCallback). `live` says whether the Realtime subscription is
// connected. Each (re)connect re-fetches right away (the poll interval
// changes), so messages sent while it was down still show.
export function useLiveChat(load, { chatId = null, pollMs = POLL_MS } = {}) {
  const [live, setLive] = useState(false)
  const polling = usePolling(load, live ? LIVE_POLL_MS : pollMs)
  const { refresh } = polling

  useEffect(() => subscribeToMessages({ chatId, onMessage: refresh, onStatus: setLive }), [chatId, refresh])

  return { ...polling, live }
}
