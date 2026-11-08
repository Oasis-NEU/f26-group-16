export const TOAST_EVENT = 'rally:toast'

// Shows a short confirmation at the bottom of the screen, from anywhere in the
// app. Use it when an action worked; failures stay next to the form as an
// ErrorMessage, so they don't disappear before someone reads them.
export function showToast(message) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }))
}
