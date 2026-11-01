import { useId, useState } from 'react'
import { PASSWORD_MIN, logIn, signUp } from '../api.jsx'
import { ErrorMessage, inputClass } from '../components/ui.jsx'

const primaryButton =
  'w-full rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60'

// Password fields get a Show/Hide button that flips the input between
// type="password" (dots) and type="text" (readable).
function Field({ label, hint, type = 'text', ...inputProps }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? 'text' : type}
          className={isPassword ? `${inputClass} pr-20` : inputClass}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 rounded-r-xl px-4 text-sm font-semibold text-brand-600 hover:underline"
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function LoginForm({ onSwitch }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await logIn(email, password)
      // App switches to the logged-in view when the session changes.
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-2 text-muted">Log in to see what’s happening on campus.</p>
      </div>
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <ErrorMessage message={error} />
      <button type="submit" className={primaryButton} disabled={busy}>
        {busy ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-center text-sm text-muted">
        New here?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-brand-600 hover:underline">
          Create an account
        </button>
      </p>
    </form>
  )
}

function SignUpForm({ onSwitch }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp({ email, fullName, password, confirmPassword })
      // Otherwise App switches to the logged-in view on its own.
      if (needsConfirmation) setSentTo(email.trim())
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl" aria-hidden="true">
          📬
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Check your inbox</h1>
        <p className="text-muted">
          We sent a link to <span className="font-semibold text-ink">{sentTo}</span>. Click it, then come back and log in.
        </p>
        <button type="button" onClick={onSwitch} className={primaryButton}>
          Go to log in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Join Rally</h1>
        <p className="mt-2 text-muted">Post events and find your people on campus.</p>
      </div>
      <Field
        label="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        required
      />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN} characters.`}
        required
      />
      <Field
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
      />
      <ErrorMessage message={error} />
      <button type="submit" className={primaryButton} disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-brand-600 hover:underline">
          Log in
        </button>
      </p>
    </form>
  )
}

// `notice` is a message from App, e.g. when a deleted account gets logged out.
export default function LoginPage({ notice }) {
  const [mode, setMode] = useState('login')

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-xl" aria-hidden="true">
            🎾
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-ink">Rally</span>
        </div>
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <ErrorMessage message={notice} />
          {mode === 'login' ? (
            <LoginForm onSwitch={() => setMode('signup')} />
          ) : (
            <SignUpForm onSwitch={() => setMode('login')} />
          )}
        </div>
      </div>
    </main>
  )
}
