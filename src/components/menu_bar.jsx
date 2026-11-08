import { useRef, useState } from 'react'
import { logOut } from '../api.jsx'
import { HOME_PATH, PROFILE_PATH, SCHEDULE_PATH, SETTINGS_PATH } from '../utils/routes.js'
import { useDismiss } from '../utils/use_dismiss.js'
import Avatar from './Avatar.jsx'
import Logo from './Logo.jsx'
import MessagesPopup from './messages_popup.jsx'
import NotificationsPopup from './notifications_popup.jsx'

const NAV_ITEMS = [
  { page: 'home', label: 'Home', icon: '🏠', href: HOME_PATH },
  { page: 'schedule', label: 'Schedule', icon: '🗓️', href: SCHEDULE_PATH },
]

// Links in the profile menu (and the ☰ menu on phones).
const PROFILE_ITEMS = [
  { page: 'profile', label: 'My profile', icon: '👤', href: PROFILE_PATH },
  { page: 'settings', label: 'Account settings', icon: '⚙️', href: SETTINGS_PATH },
]

const popupClass = 'absolute right-0 top-12 z-30 rounded-2xl border border-line bg-surface shadow-lg'

// Log out is here and on the account settings page.
function useLogOut() {
  const [busy, setBusy] = useState(false)
  const handleLogOut = async () => {
    setBusy(true)
    try {
      await logOut()
      // App switches to the login page when the session changes.
    } catch {
      setBusy(false)
    }
  }
  return [busy, handleLogOut]
}

function navLinkClass(active) {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
    active ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-brand-50 hover:text-ink'
  }`
}

function MenuLink({ item, currentPage, onClick }) {
  const active = currentPage === item.page
  return (
    <a href={item.href} onClick={onClick} aria-current={active ? 'page' : undefined} className={navLinkClass(active)}>
      <span aria-hidden="true">{item.icon}</span>
      {item.label}
    </a>
  )
}

const isProfilePage = (page) => PROFILE_ITEMS.some((item) => item.page === page)

// "Profile" button with the user's picture. Opens a list with "My profile" and
// "Account settings".
function ProfileMenu({ currentPage, profile }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)
  const active = isProfilePage(currentPage)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`${navLinkClass(active)} py-1.5`}
      >
        <Avatar user={profile} className="h-7 w-7 text-xs" />
        Profile
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div className={`${popupClass} w-56 p-2`}>
          {PROFILE_ITEMS.map((item) => (
            <MenuLink key={item.page} item={item} currentPage={currentPage} onClick={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MobileMenu({ currentPage }) {
  const [open, setOpen] = useState(false)
  const [busy, handleLogOut] = useLogOut()
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-lg text-ink hover:bg-brand-50"
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <nav aria-label="Main" className={`${popupClass} w-56 p-2`}>
          {[...NAV_ITEMS, ...PROFILE_ITEMS].map((item) => (
            <MenuLink key={item.page} item={item} currentPage={currentPage} onClick={() => setOpen(false)} />
          ))}
          <button
            type="button"
            onClick={handleLogOut}
            disabled={busy}
            className="mt-1 w-full rounded-lg border-t border-line px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-brand-50 hover:text-ink disabled:opacity-60"
          >
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </nav>
      )}
    </div>
  )
}

// Top menu bar: logo on the left; notifications and messages buttons, then
// navigation, on the right. Below `md` the navigation collapses into a ☰ menu.
export default function MenuBar({ currentPage, profile }) {
  const [busy, handleLogOut] = useLogOut()

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href={HOME_PATH} className="group flex items-center gap-2 rounded-xl">
          <Logo />
          <span className="text-xl font-extrabold tracking-tight text-ink">Rally</span>
        </a>
        <div className="flex items-center gap-2">
          <NotificationsPopup profile={profile} />
          <MessagesPopup profile={profile} />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <MenuLink key={item.page} item={item} currentPage={currentPage} />
            ))}
            <ProfileMenu currentPage={currentPage} profile={profile} />
            <button
              type="button"
              onClick={handleLogOut}
              disabled={busy}
              className="ml-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50 disabled:opacity-60"
            >
              {busy ? 'Logging out…' : 'Log out'}
            </button>
          </nav>
          <MobileMenu currentPage={currentPage} />
        </div>
      </div>
    </header>
  )
}
