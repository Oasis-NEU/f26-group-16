import { useEffect, useId, useRef } from 'react'
import { ErrorMessage, dangerButton, secondaryButton } from './ui.jsx'

// Modal "are you sure?" popup for destructive actions. Uses <dialog> so Escape
// cancels and keyboard focus stays inside while it's open. While `busy`, it
// can't be dismissed, so the request can't be left running behind a closed popup.
export default function ConfirmDialog({ open, title, children, confirmLabel, busyLabel, busy, error, onConfirm, onCancel }) {
  const ref = useRef(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const cancel = () => !busy && onCancel()

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape fires `cancel`; handle it ourselves so a busy dialog stays open.
      onCancel={(e) => {
        e.preventDefault()
        cancel()
      }}
      // A click on the dialog itself (not its contents) is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && cancel()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-brand-900/60"
    >
      <div className="space-y-4 p-6">
        <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
          {title}
        </h2>
        <div id={bodyId} className="space-y-2 text-sm text-muted">
          {children}
        </div>
        <ErrorMessage message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* First in the DOM, so showModal() focuses it and pressing Enter right away doesn't delete anything. */}
          <button type="button" onClick={cancel} disabled={busy} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={dangerButton}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
