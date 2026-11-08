import { useEffect, useState } from 'react'
import { TOAST_EVENT } from '../utils/toast.js'

const VISIBLE_MS = 3000

// Shows the latest showToast() message. The live region stays mounted so screen
// readers announce each new message.
export default function Toaster() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    let timer
    const onToast = (event) => {
      clearTimeout(timer)
      setMessage(event.detail)
      timer = setTimeout(() => setMessage(''), VISIBLE_MS)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(TOAST_EVENT, onToast)
    }
  }, [])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center">
      {message && (
        <p className="max-w-md break-words rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">{message}</p>
      )}
    </div>
  )
}
