export const OPEN_CHAT_EVENT = 'numeet:open-chat'

// Opens the messages popup on a chat from anywhere in the app. `chatKey` is a
// direct chat's chat_id, or groupChatKey(eventId) for an event's group chat.
export function openChat(chatKey) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: chatKey }))
}

// Group chats are keyed "event:<event_id>" in the popup. Direct chat ids are
// UUIDs, so the two can't be mixed up.
const GROUP_PREFIX = 'event:'
export const groupChatKey = (eventId) => `${GROUP_PREFIX}${eventId}`
// The event id from a group chat key, or null for a direct chat.
export const groupChatEventId = (chatKey) => (chatKey?.startsWith(GROUP_PREFIX) ? chatKey.slice(GROUP_PREFIX.length) : null)

export function openGroupChat(eventId) {
  openChat(groupChatKey(eventId))
}
