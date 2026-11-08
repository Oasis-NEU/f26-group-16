export const OPEN_CHAT_EVENT = 'rally:open-chat'

// Opens the messages popup on a chat from anywhere in the app.
export function openChat(chatId) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: chatId }))
}
