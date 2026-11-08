import { useCallback, useEffect, useRef, useState } from 'react'
import { listNotifications, markNotificationsRead } from '../api.jsx'
import { displayName, formatTimestamp } from '../utils/format.js'
import { eventPath } from '../utils/routes.js'
import { useDismiss } from '../utils/use_dismiss.js'
import { usePolling } from '../utils/use_polling.js'
import { ConnectionBanner, PopupNote, popupPanelClass } from './ui.jsx'

// Slower than chats: this runs the whole time you're logged in, to keep the
// unread count on the button up to date.
const POLL_MS = 5000

function notificationText(notification) {
  const actor = displayName(notification.actor)
  const title = notification.event?.event_title
  if (notification.notification_type === 'event_joined') return `${actor} joined ${title}`
  return title
}

// Mounted only while open. Marks everything as read as it arrives; those stay
// highlighted until the popup closes.
function NotificationsPanel({ notifications, failed, unreadIds, uid, refresh, onClose }) {
  const [highlighted, setHighlighted] = useState(() => new Set(unreadIds))
  if (unreadIds.some((id) => !highlighted.has(id))) setHighlighted(new Set([...highlighted, ...unreadIds]))

  const unreadKey = unreadIds.join()
  useEffect(() => {
    if (!unreadKey) return
    // A failed update just leaves them unread until the popup is next opened.
    markNotificationsRead(uid).then(refresh, () => {})
  }, [unreadKey, uid, refresh])

  return (
    <div role="dialog" aria-label="Notifications" className={popupPanelClass}>
      <h2 className="border-b border-line px-5 py-4 font-bold text-ink">Notifications</h2>
      <ConnectionBanner show={failed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {notifications === null && !failed && <PopupNote>Loading…</PopupNote>}
        {notifications?.length === 0 && <PopupNote>Nothing yet. You’ll see it here when someone joins your event.</PopupNote>}
        {notifications?.length > 0 && (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
              <li key={notification.notification_id}>
                <a
                  href={eventPath(notification.event_id)}
                  onClick={onClose}
                  className={`block px-5 py-3 ${highlighted.has(notification.notification_id) ? 'bg-brand-100' : 'hover:bg-brand-50'}`}
                >
                  <span className="block break-words text-sm text-ink">{notificationText(notification)}</span>
                  <span className="mt-0.5 block text-xs text-muted">{formatTimestamp(notification.create_time)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Menu bar bell with the unread count, and its popup.
export default function NotificationsPopup({ profile }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)

  const load = useCallback(() => listNotifications(profile.uid), [profile.uid])
  const { data: notifications, failed, refresh } = usePolling(load, POLL_MS)
  const unreadIds = notifications?.filter((n) => !n.is_read).map((n) => n.notification_id) ?? []

  return (
    <div ref={ref} className="lg:relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadIds.length > 0 ? `Notifications, ${unreadIds.length} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-lg hover:bg-brand-50"
      >
        <span aria-hidden="true">🔔</span>
        {unreadIds.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white"
          >
            {unreadIds.length > 9 ? '9+' : unreadIds.length}
          </span>
        )}
      </button>
      {open && (
        <NotificationsPanel
          notifications={notifications}
          failed={failed}
          unreadIds={unreadIds}
          uid={profile.uid}
          refresh={refresh}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
