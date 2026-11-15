// Light/dark theme switch. index.html applies the saved choice (or the device
// setting) before first paint; this keeps it in sync after that.
import { useSyncExternalStore } from 'react'

// Also read by the inline script in index.html.
const THEME_KEY = 'numeet-theme'

const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set()

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

function apply(dark) {
  document.documentElement.classList.toggle('dark', dark)
  listeners.forEach((listener) => listener())
}

// Until the user picks a theme, follow the device setting as it changes.
media.addEventListener('change', (event) => {
  if (!savedTheme()) apply(event.matches)
})

// Keep other open tabs in step.
window.addEventListener('storage', (event) => {
  if (event.key === THEME_KEY) apply(event.newValue ? event.newValue === 'dark' : media.matches)
})

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const isDark = () => document.documentElement.classList.contains('dark')

// Returns [dark, toggle]. Toggling saves the choice, so it sticks on later visits.
export function useDarkMode() {
  const dark = useSyncExternalStore(subscribe, isDark)
  const toggle = () => {
    const next = !isDark()
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      // Storage blocked (e.g. private mode): the switch still works for this visit.
    }
    apply(next)
  }
  return [dark, toggle]
}
