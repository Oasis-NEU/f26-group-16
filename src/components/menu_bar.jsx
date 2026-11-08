import { useRef, useState } from 'react'
import { logOut } from '../api.jsx'
import { HOME_PATH, PROFILE_PATH, SCHEDULE_PATH } from '../utils/routes.js'
import { useDismiss } from '../utils/use_dismiss.js'
import Logo from './Logo.jsx'
import MessagesPopup from './messages_popup.jsx'

const NAV_ITEMS = [
  { page: 'home', label: 'Home', icon: '🏠', href: HOME_PATH },
  { page: 'schedule', label: 'Schedule', icon: '🗓️', href: SCHEDULE_PATH },
  { page: 'profile', label: 'Profile', icon: '👤', href: PROFILE_PATH },
]

const popupClass = 'absolute right-0 top-12 z-30 rounded-2xl border border-line bg-surface shadow-lg'

// Log out lives here until the account settings popup takes it over.
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
          {NAV_ITEMS.map((item) => (
            <a
              key={item.page}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={currentPage === item.page ? 'page' : undefined}
              className={navLinkClass(currentPage === item.page)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
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

// Top menu bar: logo on the left; messages button, then navigation, on the
// right. Below `md` the navigation collapses into a ☰ menu.
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
          <MessagesPopup profile={profile} />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.page}
                href={item.href}
                aria-current={currentPage === item.page ? 'page' : undefined}
                className={navLinkClass(currentPage === item.page)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </a>
            ))}
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
