import { useId, useState } from 'react'
import {
  NAME_MAX,
  PASSWORD_MIN,
  PROFILE_PIC_MAX,
  changePassword,
  deleteAccount,
  fileToDataUrl,
  logOut,
  updateProfile,
} from '../api.jsx'
import Avatar from '../components/Avatar.jsx'
import { ErrorMessage, inputClass, primaryButton, secondaryButton, smallButton } from '../components/ui.jsx'
import { PROFILE_PATH } from '../utils/routes.js'
import { showToast } from '../utils/toast.js'

const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-danger bg-danger-50 px-6 py-3 font-semibold text-danger hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'

function Section({ title, description, children }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <div>
        <h2 id={id} className="text-xl font-bold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, ...inputProps }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input id={id} className={inputClass} {...inputProps} />
    </div>
  )
}

// Runs an async action with busy and error state. Returns true if it worked.
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function PictureSection({ profile, onProfileChange }) {
  const { busy, error, run } = useAction()

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    run(async () => {
      const pictureData = await fileToDataUrl(file, { maxWidth: PROFILE_PIC_MAX, maxHeight: PROFILE_PIC_MAX })
      onProfileChange(await updateProfile(profile.uid, { pictureData }))
      showToast('Profile picture updated.')
    })
  }

  const reset = () =>
    run(async () => {
      onProfileChange(await updateProfile(profile.uid, { pictureData: null }))
      showToast('Profile picture removed.')
    })

  return (
    <Section title="Profile picture" description="Any image works. It’s resized and saved as WebP.">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar user={profile} className="h-20 w-20 text-3xl" />
        <div className="flex flex-wrap gap-2">
          <label className={`${smallButton} cursor-pointer focus-within:ring-2 focus-within:ring-brand-500`}>
            {busy ? 'Saving…' : 'Change picture'}
            <input type="file" accept="image/*" onChange={pick} disabled={busy} className="sr-only" />
          </label>
          {profile.profile_pic_data && (
            <button type="button" onClick={reset} disabled={busy} className={smallButton}>
              Reset picture
            </button>
          )}
        </div>
      </div>
      <ErrorMessage message={error} />
    </Section>
  )
}

function NameSection({ profile, onProfileChange }) {
  const [name, setName] = useState(profile.full_name)
  const { busy, error, run } = useAction()
  const unchanged = name.trim() === profile.full_name

  const submit = (event) => {
    event.preventDefault()
    run(async () => {
      const row = await updateProfile(profile.uid, { fullName: name })
      onProfileChange(row)
      setName(row.full_name)
      showToast('Name saved.')
    })
  }

  return (
    <Section title="Your name" description="Shown on your events, comments, and messages.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} required autoComplete="name" />
        <ErrorMessage message={error} />
        <button type="submit" disabled={busy || unchanged || !name.trim()} className={primaryButton}>
          {busy ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </Section>
  )
}

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const { busy, error, run } = useAction()

  const submit = async (event) => {
    event.preventDefault()
    const ok = await run(() => changePassword({ currentPassword: current, newPassword: next, confirmPassword: confirm }))
    if (ok) {
      setCurrent('')
      setNext('')
      setConfirm('')
      showToast('Password updated.')
    }
  }

  return (
    <Section title="Change password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={PASSWORD_MIN}
            required
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <p className="text-xs text-muted">At least {PASSWORD_MIN} characters.</p>
        <ErrorMessage message={error} />
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Section>
  )
}

function LogOutSection() {
  const { busy, error, run } = useAction()
  return (
    <Section title="Log out" description="You’ll need your email and password to log back in.">
      <button type="button" onClick={() => run(logOut)} disabled={busy} className={secondaryButton}>
        {busy ? 'Logging out…' : 'Log out'}
      </button>
      <ErrorMessage message={error} />
    </Section>
  )
}

function DeleteSection({ profile, onAccountDeleted }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAction()

  const submit = async (event) => {
    event.preventDefault()
    const ok = await run(() => deleteAccount(profile.uid, password))
    if (ok) onAccountDeleted()
  }

  return (
    <Section title="Delete account" description="This can’t be undone from the app.">
      {open ? (
        <form onSubmit={submit} className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Your login is removed, so you can sign up again with the same email later.</li>
            <li>Your events disappear from the homepage and schedules.</li>
            <li>Your comments and messages stay, but show as “Deleted account”.</li>
          </ul>
          <Field
            label="Enter your password to confirm"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <ErrorMessage message={error} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !password} className={dangerButton}>
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={dangerButton}>
          Delete account…
        </button>
      )}
    </Section>
  )
}

export default function AccountSettings({ profile, onProfileChange, onAccountDeleted }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <a href={PROFILE_PATH} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <span aria-hidden="true">←</span> Your profile
      </a>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Account settings</h1>
      <PictureSection profile={profile} onProfileChange={onProfileChange} />
      <NameSection profile={profile} onProfileChange={onProfileChange} />
      <PasswordSection />
      <LogOutSection />
      <DeleteSection profile={profile} onAccountDeleted={onAccountDeleted} />
    </div>
  )
}
