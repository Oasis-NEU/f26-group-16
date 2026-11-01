// Shared styles and small building blocks used by more than one page.
// Button and input styles follow AGENTS.md → Layout and components.

export const inputClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60'
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 font-semibold text-ink hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60'
export const smallButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60'

export function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  )
}

// Centered message card for empty, not-found, and coming-soon states.
export function Notice({ icon, title, children }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface px-6 py-12 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl" aria-hidden="true">
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-4 text-muted">{children}</div>
    </div>
  )
}
