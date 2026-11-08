// Hash-based routes (no router library). Link with the path builders below,
// e.g. <a href={eventPath(id)}>, and App renders the page that matches.

import { useEffect, useState } from 'react'

export const HOME_PATH = '#/'
export const NEW_EVENT_PATH = '#/event/new'
export const SCHEDULE_PATH = '#/schedule'
export const PROFILE_PATH = '#/profile'
export const SETTINGS_PATH = '#/settings'
export const eventPath = (eventId) => `#/event/${encodeURIComponent(eventId)}`
export const editEventPath = (eventId) => `${eventPath(eventId)}/edit`
export const profilePath = (uid) => `${PROFILE_PATH}/${encodeURIComponent(uid)}`

// Turns a hash like "#/event/<id>/edit" into { page, ...params }.
export function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [section, id, action] = parts
  if (parts.length === 0) return { page: 'home' }
  if (section === 'event' && id === 'new' && parts.length === 2) return { page: 'new-event' }
  if (section === 'event' && parts.length === 2) return { page: 'event', eventId: id }
  if (section === 'event' && action === 'edit' && parts.length === 3) return { page: 'edit-event', eventId: id }
  if (section === 'schedule' && parts.length === 1) return { page: 'schedule' }
  if (section === 'settings' && parts.length === 1) return { page: 'settings' }
  // "#/profile" is the logged-in user; "#/profile/<uid>" is someone else's.
  if (section === 'profile' && parts.length <= 2) return { page: 'profile', uid: id ?? null }
  return { page: 'not-found' }
}

// The current route, updated whenever the hash changes.
export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parseRoute(hash)
}

export function navigate(path) {
  window.location.hash = path
}
