import { useEffect, useState } from 'react'
import { getProfile, logOut, onSessionChange } from './api.jsx'
import LoginPage from './pages/login_page.jsx'

function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page text-muted" aria-busy="true">
      Loading…
    </main>
  )
}

// Placeholder until the homepage and top menu bar land. Log out will move into
// the account settings popup.
function Home({ profile }) {
  const [busy, setBusy] = useState(false)

  const handleLogOut = async () => {
    setBusy(true)
    try {
      await logOut()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg" aria-hidden="true">
              🎾
            </span>
            <span className="text-xl font-extrabold tracking-tight text-ink">Rally</span>
          </div>
          <button
            type="button"
            onClick={handleLogOut}
            disabled={busy}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-50 disabled:opacity-60"
          >
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">You’re in, {profile.full_name}.</h1>
        <p className="mt-3 text-muted">The event board is coming soon.</p>
      </main>
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
  return <Home profile={profile} />
}

export default App
