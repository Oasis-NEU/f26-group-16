import { useEffect, useState } from 'react'
import { getProfile, logOut, onSessionChange } from './api.jsx'
import MenuBar from './components/menu_bar.jsx'
import Toaster from './components/toaster.jsx'
import { Notice, primaryButton } from './components/ui.jsx'
import AccountProfile from './pages/account_profile.jsx'
import AccountSettings from './pages/account_settings.jsx'
import EditEvent from './pages/edit_event.jsx'
import EventDetail from './pages/event_detail.jsx'
import Homepage from './pages/homepage.jsx'
import LoginPage from './pages/login_page.jsx'
import Schedule from './pages/schedule.jsx'
import { HOME_PATH, useRoute } from './utils/routes.js'

function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page text-muted" aria-busy="true">
      Loading…
    </main>
  )
}

// Pages get the logged-in `profile` row. Settings also gets callbacks for
// updating it and for account deletion.
function currentPage(route, { profile, onProfileChange, onAccountDeleted }) {
  switch (route.page) {
    case 'home':
      return <Homepage />
    case 'new-event':
      return <EditEvent eventId={null} profile={profile} />
    case 'event':
      return <EventDetail key={route.eventId} eventId={route.eventId} profile={profile} />
    case 'edit-event':
      return <EditEvent key={route.eventId} eventId={route.eventId} profile={profile} />
    case 'schedule':
      return <Schedule profile={profile} />
    case 'profile':
      return <AccountProfile key={route.uid ?? 'me'} uid={route.uid ?? profile.uid} profile={profile} />
    case 'settings':
      return <AccountSettings profile={profile} onProfileChange={onProfileChange} onAccountDeleted={onAccountDeleted} />
    default:
      return (
        <Notice icon="🧭" title="Page not found">
          <a href={HOME_PATH} className={primaryButton}>
            Back to events
          </a>
        </Notice>
      )
  }
}

// The logged-in app: menu bar plus the page for the current hash route.
function Shell(account) {
  const { profile } = account
  const route = useRoute()
  // Someone else's profile doesn't highlight your own "Profile" menu.
  const isOtherProfile = route.page === 'profile' && route.uid && route.uid !== profile.uid
  const navPage = isOtherProfile ? null : route.page

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.page, route.eventId, route.uid])

  return (
    <div className="min-h-screen bg-page">
      <MenuBar currentPage={navPage} profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">{currentPage(route, account)}</main>
      <Toaster />
    </div>
  )
}

function App() {
  // undefined = still checking, null = logged out
  const [session, setSession] = useState(undefined)
  // Tagged with the auth id it belongs to, so a stale profile is never shown.
  const [loaded, setLoaded] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => onSessionChange(setSession), [])

  const authId = session?.user.id
  const profile = authId && loaded?.authId === authId ? loaded.row : null

  useEffect(() => {
    if (!authId) return
    let cancelled = false
    getProfile(authId)
      .then((row) => {
        if (cancelled) return
        if (row?.is_active) {
          setLoaded({ authId, row })
          setNotice('')
        } else {
          setNotice(row ? 'This account has been deleted.' : 'Your account isn’t set up yet. Ask the team to check the users table.')
          logOut()
        }
      })
      .catch((err) => {
        if (!cancelled) setNotice(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [authId])

  if (session === undefined) return <Loading />
  if (!session) return <LoginPage notice={notice} />
  if (!profile) return notice ? <LoginPage notice={notice} /> : <Loading />
  return (
    <Shell
      profile={profile}
      // Settings saves return the updated row, so the whole app sees the change.
      onProfileChange={(row) => setLoaded({ authId, row })}
      // deleteAccount() already logged out; the login page shows this.
      onAccountDeleted={() => setNotice('Your account has been deleted.')}
    />
  )
}

export default App
