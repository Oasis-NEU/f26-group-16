export const OPEN_CHAT_EVENT = 'numeet:open-chat'

// Opens the messages popup on a chat from anywhere in the app.
export function openChat(chatId) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: chatId }))
}

// An event's group chat id in chats_list / chat_msgs. Database triggers use
// the same "event:<event_id>" form; direct chat ids are UUIDs, so they can't
// clash.
export const groupChatId = (eventId) => `event:${eventId}`

export function openGroupChat(eventId) {
  openChat(groupChatId(eventId))
}
