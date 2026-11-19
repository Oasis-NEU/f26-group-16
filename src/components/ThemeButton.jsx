import { useDarkMode } from '../utils/theme.js'

// ☀️/🌙 button that switches between light and dark mode. It shows the theme
// it switches to. `className` sets when it shows (e.g. "hidden md:flex" in the
// menu bar, where the ☰ menu has the switch below `md`).
export default function ThemeButton({ className = 'flex' }) {
  const [dark, toggle] = useDarkMode()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-lg hover:bg-brand-50 ${className}`}
    >
      <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}
