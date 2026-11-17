// Read/write functions for the Supabase database. Pages call these instead of
// using the client directly. Every function throws an Error on bad input or a
// failed query, so callers can wrap them in try/catch.
//
// Times are stored as UNIX timestamps in seconds (BIGINT columns).

import { joinedCount } from './utils/capacity.js'
import { supabase } from './utils/supabase.js'

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 5000
export const LOCATION_MAX = 200
export const COMMENT_MAX = 2000
export const MESSAGE_MAX = 2000
export const CHAT_NAME_MAX = 100
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
// Smallest headcount limit an event can have (matches the CHECK on max_participants).
export const CAPACITY_MIN = 2

// Pictures are stored as WebP data URLs. The length limit matches the CHECK
// rule on picture columns: the prefix plus the base64 of 10 MiB.
const WEBP_PREFIX = 'data:image/webp;base64,'
const IMAGE_DATA_URL_MAX = WEBP_PREFIX.length + 4 * Math.ceil(IMAGE_MAX_BYTES / 3)

const nowSeconds = () => Math.floor(Date.now() / 1000)

// Columns the app reads from `users`.
const USER_COLUMNS = 'uid, full_name, profile_pic_data, is_active'

// Event rows come with `organizer` ({ uid, full_name, is_active }),
// `category` ({ category_id, name }, or null), and `joined` ([{ count }], how
// many people joined; read it with joinedCount() from src/utils/capacity.js).
const EVENT_COLUMNS =
  '*, organizer:users(uid, full_name, is_active), category:event_categories(category_id, name), joined:joined_events(count)'

// Comment rows come with `sender` ({ uid, full_name, profile_pic_data, is_active })
// attached, so comments can show the sender's picture with <Avatar>.
const COMMENT_COLUMNS = `*, sender:users(${USER_COLUMNS})`

// Newest messages a chat loads. The popup re-fetches on every new message (and
// polls when Realtime is down), so this keeps each fetch small however long the
// chat gets.
const MESSAGE_FETCH_LIMIT = 200

// Notification rows come with `actor` (who did it: { uid, full_name, is_active },
// null for reminders) and `event` ({ event_id, event_title, start_time }, null
// once the event is deleted) attached. The foreign key is named because
// notifications has two links to `users`.
const NOTIFICATION_COLUMNS =
  '*, actor:users!notifications_actor_uid_fkey(uid, full_name, is_active), event:events(event_id, event_title, start_time)'
const NOTIFICATION_FETCH_LIMIT = 30

function check(condition, message) {
  if (!condition) throw new Error(message)
}

// Turns a Supabase error into one with a message we can show to users.
function toError(error) {
  if (/failed to fetch|network/i.test(error.message)) {
    return new Error('Can’t reach the server. Check your internet and try again.')
  }
  return new Error(error.message)
}

function unwrap({ data, error }) {
  if (error) throw toError(error)
  return data
}

// ---------- validation ----------

export function validateEvent({ title, description, location, startTime, endTime, pictureData, maxParticipants }) {
  check(typeof title === 'string' && title.trim().length > 0, 'Title is required.')
  check(title.trim().length <= TITLE_MAX, `Title must be ${TITLE_MAX} characters or less.`)
  check(!description || description.trim().length <= DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or less.`)
  check(!location || location.trim().length <= LOCATION_MAX, `Location must be ${LOCATION_MAX} characters or less.`)
  check(Number.isInteger(startTime), 'Start time is required.')
  if (endTime != null) {
    check(Number.isInteger(endTime), 'End time must be a UNIX timestamp.')
    check(endTime >= startTime, 'End time can’t be before the start time.')
  }
  if (pictureData != null) validateImageDataUrl(pictureData)
  // null = no limit
  if (maxParticipants != null) {
    check(Number.isInteger(maxParticipants), 'The headcount must be a whole number.')
    check(maxParticipants >= CAPACITY_MIN, `The headcount must be at least ${CAPACITY_MIN}.`)
  }
}

export function validateImageDataUrl(dataUrl) {
  check(typeof dataUrl === 'string' && dataUrl.startsWith(WEBP_PREFIX), 'Picture must be a WebP image.')
  check(dataUrl.length <= IMAGE_DATA_URL_MAX, 'Picture must be 10MB or smaller.')
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Couldn’t read the picture.'))
    reader.readAsDataURL(blob)
  })
}

// Turns an <input type="file"> File into a WebP data URL, scaled down to fit
// maxWidth x maxHeight (1920x1080 for event pictures). Safari's canvas can't
// export WebP, so encoding uses @jsquash/webp, loaded on first use to keep it
// out of the main bundle.
export async function fileToDataUrl(file, { maxWidth = 1920, maxHeight = 1080, quality = 80 } = {}) {
  check(file?.type?.startsWith('image/'), 'Picture must be an image.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Couldn’t read the picture. Try a JPEG, PNG, or WebP file.')
  }
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let webp
  try {
    const { encode } = await import('@jsquash/webp')
    webp = await encode(context.getImageData(0, 0, width, height), { quality })
  } catch {
    throw new Error('Couldn’t convert the picture. Check your internet and try again.')
  }
  const dataUrl = await blobToDataUrl(new Blob([webp], { type: 'image/webp' }))
  validateImageDataUrl(dataUrl)
  return dataUrl
}

// ---------- auth ----------
// Login uses Supabase Auth with the user's real email (setup steps in
// docs/auth-setup.md). `users.uid` is the Supabase Auth user id, so the RLS
// rules in AGENTS.md can compare it with auth.uid(). A database trigger
// creates the matching `users` row on sign-up.

export const PASSWORD_MIN = 8
export const NAME_MAX = 100

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// Returns { needsConfirmation: true } when "Confirm email" is on in Supabase:
// the user has to click the link in their inbox before they can log in.
export async function signUp({ email, fullName, password, confirmPassword }) {
  check(isValidEmail(email?.trim()), 'Enter a valid email.')
  check(fullName?.trim(), 'Enter your full name.')
  check(fullName.trim().length <= NAME_MAX, `Name must be ${NAME_MAX} characters or less.`)
  check(password?.length >= PASSWORD_MIN, `Password needs at least ${PASSWORD_MIN} characters.`)
  check(password === confirmPassword, 'Passwords don’t match.')
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  })
  if (error?.message === 'User already registered') throw new Error('That email already has an account. Try logging in.')
  if (error) throw toError(error)
  return { needsConfirmation: !data.session }
}

// App checks `is_active` after every login and logs deleted accounts back out.
export async function logIn(email, password) {
  check(isValidEmail(email?.trim()), 'Enter a valid email.')
  check(password, 'Enter your password.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error?.message === 'Invalid login credentials') throw new Error('Wrong email or password.')
  if (error?.message === 'Email not confirmed') throw new Error('Confirm your email first. Check your inbox for the link.')
  if (error) throw toError(error)
  return data.user
}

export async function logOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw toError(error)
}

// Calls back with the current session right away, then on every login/logout.
// The second argument is Supabase's event name, e.g. 'SIGNED_OUT'.
// Returns a function that stops listening.
export function onSessionChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event))
  return () => data.subscription.unsubscribe()
}

// The `users` row for a logged-in Supabase Auth user (uid = Auth user id).
export async function getProfile(authId) {
  return getUser(authId)
}

// Checks the logged-in user's password by logging in again with it. Supabase's
// updateUser doesn't ask for the current password, so the settings page uses
// this before changing the password or deleting the account.
async function verifyPassword(password) {
  check(password, 'Enter your current password.')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw toError(error)
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.user.email, password })
  if (signInError?.message === 'Invalid login credentials') throw new Error('Your current password is wrong.')
  if (signInError) throw toError(signInError)
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  check(currentPassword, 'Enter your current password.')
  check(newPassword?.length >= PASSWORD_MIN, `New password needs at least ${PASSWORD_MIN} characters.`)
  check(newPassword === confirmPassword, 'New passwords don’t match.')
  check(newPassword !== currentPassword, 'Pick a password you aren’t using now.')
  await verifyPassword(currentPassword)
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw toError(error)
}

// Marks the account deleted (is_active = false). A database trigger then
// removes its Supabase Auth login so the email can sign up again, which ends
// the session on the server, so this only clears it in the browser.
export async function deleteAccount(uid, password) {
  check(uid, 'Missing account.')
  await verifyPassword(password)
  unwrap(await supabase.from('users').update({ is_active: false }).eq('uid', uid))
  await supabase.auth.signOut({ scope: 'local' })
}

// ---------- users ----------

// Profile pictures are scaled to fit 512x512: every user fetch includes them.
export const PROFILE_PIC_MAX = 512

// Only the fields passed in are changed. `pictureData: null` removes the picture.
export async function updateProfile(uid, { fullName, pictureData } = {}) {
  check(uid, 'Missing account.')
  const row = {}
  if (fullName !== undefined) {
    const name = fullName?.trim() ?? ''
    check(name, 'Enter your full name.')
    check(name.length <= NAME_MAX, `Name must be ${NAME_MAX} characters or less.`)
    row.full_name = name
  }
  if (pictureData !== undefined) {
    if (pictureData !== null) validateImageDataUrl(pictureData)
    row.profile_pic_data = pictureData
  }
  check(Object.keys(row).length > 0, 'Nothing to save.')
  return unwrap(await supabase.from('users').update(row).eq('uid', uid).select(USER_COLUMNS).single())
}

export async function getUser(uid) {
  return unwrap(await supabase.from('users').select(USER_COLUMNS).eq('uid', uid).maybeSingle())
}

export async function getUsers(uids) {
  if (uids.length === 0) return []
  return unwrap(await supabase.from('users').select(USER_COLUMNS).in('uid', uids))
}

// ---------- categories ----------

export async function listCategories() {
  return unwrap(await supabase.from('event_categories').select('*').order('name'))
}

// ---------- events ----------

// Same shape as EVENT_COLUMNS, but the inner join lets listings filter out
// events whose organizer deleted their account.
const ACTIVE_EVENT_COLUMNS =
  '*, organizer:users!inner(uid, full_name, is_active), category:event_categories(category_id, name), joined:joined_events(count)'

// Soonest first. Filters are optional: categoryId, and a [from, to] window on
// start_time. Events by deleted accounts are left out (they still open by link).
export async function listEvents({ categoryId, from, to } = {}) {
  let query = supabase.from('events').select(ACTIVE_EVENT_COLUMNS).eq('organizer.is_active', true)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (from != null) query = query.gte('start_time', from)
  if (to != null) query = query.lte('start_time', to)
  return unwrap(await query.order('start_time', { ascending: true }))
}

export async function listEventsByOrganizer(uid) {
  return unwrap(
    await supabase.from('events').select(EVENT_COLUMNS).eq('organizer_uid', uid).order('start_time', { ascending: false }),
  )
}

export async function getEvent(eventId) {
  return unwrap(await supabase.from('events').select(EVENT_COLUMNS).eq('event_id', eventId).maybeSingle())
}

export async function createEvent({
  title,
  description,
  location,
  startTime,
  endTime,
  organizerUid,
  categoryId,
  pictureData,
  maxParticipants = null,
}) {
  validateEvent({ title, description, location, startTime, endTime, pictureData, maxParticipants })
  check(organizerUid, 'Organizer is required.')
  const row = {
    event_id: crypto.randomUUID(),
    event_title: title.trim(),
    event_description: description?.trim() || null,
    create_time: nowSeconds(),
    start_time: startTime,
    end_time: endTime ?? null,
    location: location?.trim() || null,
    organizer_uid: organizerUid,
    category_id: categoryId || null,
    picture_data: pictureData ?? null,
    max_participants: maxParticipants,
  }
  return unwrap(await supabase.from('events').insert(row).select(EVENT_COLUMNS).single())
}

// The limit can't drop below the people already in. The database checks this
// too (trg_check_capacity_not_below_joined in docs/main_schema.sql).
export function capacityBelowJoinedMessage(joined) {
  return `${joined} ${joined === 1 ? 'person has' : 'people have'} already joined, so the headcount can’t be lower than ${joined}.`
}

// Only the fields passed in `changes` are updated.
export async function updateEvent(eventId, changes) {
  const current = await getEvent(eventId)
  check(current, 'Event not found.')
  const merged = {
    title: changes.title ?? current.event_title,
    description: changes.description !== undefined ? changes.description : current.event_description,
    location: changes.location !== undefined ? changes.location : current.location,
    startTime: changes.startTime ?? current.start_time,
    endTime: changes.endTime !== undefined ? changes.endTime : current.end_time,
    pictureData: changes.pictureData !== undefined ? changes.pictureData : current.picture_data,
    maxParticipants: changes.maxParticipants !== undefined ? changes.maxParticipants : current.max_participants,
  }
  validateEvent(merged)
  const joined = joinedCount(current)
  check(merged.maxParticipants == null || merged.maxParticipants >= joined, capacityBelowJoinedMessage(joined))
  const row = {
    event_title: merged.title.trim(),
    event_description: merged.description?.trim() || null,
    location: merged.location?.trim() || null,
    start_time: merged.startTime,
    end_time: merged.endTime,
    picture_data: merged.pictureData,
    max_participants: merged.maxParticipants,
  }
  if (changes.categoryId !== undefined) row.category_id = changes.categoryId || null
  const { data, error } = await supabase.from('events').update(row).eq('event_id', eventId).select(EVENT_COLUMNS).single()
  // Someone joined between our check and the save.
  if (error?.message === 'capacity_below_joined') {
    throw new Error('More people joined just now, so that headcount is too low. Reload and try again.')
  }
  if (error) throw toError(error)
  return data
}

// The event's comments and joins are removed by ON DELETE CASCADE.
export async function deleteEvent(eventId) {
  unwrap(await supabase.from('events').delete().eq('event_id', eventId))
}

// ---------- joined events ----------

export async function countJoiners(eventId) {
  const { count, error } = await supabase
    .from('joined_events')
    .select('joiner_uid', { count: 'exact', head: true })
    .eq('event_id', eventId)
  if (error) throw toError(error)
  return count
}

// People who joined an event, as { uid, full_name, profile_pic_data, is_active }.
export async function listJoiners(eventId) {
  check(eventId, 'Missing event.')
  const rows = unwrap(await supabase.from('joined_events').select(`joiner:users(${USER_COLUMNS})`).eq('event_id', eventId))
  return rows.map((row) => row.joiner).filter(Boolean)
}

export async function hasJoined(eventId, uid) {
  const rows = unwrap(
    await supabase.from('joined_events').select('event_id').eq('event_id', eventId).eq('joiner_uid', uid).limit(1),
  )
  return rows.length > 0
}

// The database rejects the join with "event_full" once the event reaches its
// headcount (trg_check_event_capacity in docs/main_schema.sql), so a stale
// page can't overfill it.
export async function joinEvent(eventId, uid) {
  const { error } = await supabase.from('joined_events').insert({ event_id: eventId, joiner_uid: uid })
  // 23505 = unique violation, i.e. already joined. Treat that as success.
  if (error?.code === '23505') return
  if (error?.message === 'event_full') {
    // `code` lets the page tell this apart from other failures.
    throw Object.assign(new Error('Sorry, this event just filled up.'), { code: 'event_full' })
  }
  if (error) throw toError(error)
}

export async function leaveEvent(eventId, uid) {
  unwrap(await supabase.from('joined_events').delete().eq('event_id', eventId).eq('joiner_uid', uid))
}

// Events the user joined, soonest first (for the personal schedule page).
export async function listJoinedEvents(uid) {
  const rows = unwrap(await supabase.from('joined_events').select('event_id').eq('joiner_uid', uid))
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.event_id)
  return unwrap(
    await supabase.from('events').select(EVENT_COLUMNS).in('event_id', ids).order('start_time', { ascending: true }),
  )
}

// ---------- comments ----------

// Oldest first. Replies have `replying_to` set to their main comment's id.
export async function listComments(eventId) {
  return unwrap(
    await supabase
      .from('event_comments')
      .select(COMMENT_COLUMNS)
      .eq('event_id', eventId)
      .order('comment_time', { ascending: true }),
  )
}

// `replyingTo` must be a main comment's id: replies stay one level deep, so a
// reply to a reply goes on the main comment instead.
export async function addComment({ eventId, senderUid, content, replyingTo = null }) {
  const text = content?.trim() ?? ''
  check(text, 'Write something first.')
  check(text.length <= COMMENT_MAX, `Comments must be ${COMMENT_MAX} characters or less.`)
  check(senderUid, 'Sender is required.')
  const row = {
    comment_id: crypto.randomUUID(),
    event_id: eventId,
    comment_content: text,
    comment_time: nowSeconds(),
    sender_uid: senderUid,
    replying_to: replyingTo,
  }
  return unwrap(await supabase.from('event_comments').insert(row).select(COMMENT_COLUMNS).single())
}

// RLS only lets the sender delete a comment. Deleting a main comment also
// removes its replies (ON DELETE CASCADE), including other people's.
export async function deleteComment(commentId) {
  check(commentId, 'Missing comment.')
  unwrap(await supabase.from('event_comments').delete().eq('comment_id', commentId))
}

// ---------- chats (direct and event group) ----------
// A chat has one chats_list row per participant, sharing a chat_id, and its
// messages are in chat_msgs.
// - Direct chats: two people, `event_id` null.
// - Event group chats: `event_id` set and chat_id "event:<event_id>"
//   (groupChatId in src/utils/chat_events.js). Database triggers add the
//   organizer and everyone who joins, and remove people who leave, so the app
//   never adds or removes these rows. See docs/main_schema.sql.
// Each row's `chat_name` is that user's own label for the chat, or null to
// show the other person's name / the event title (chatTitle() in
// src/utils/format.js). renameChat() is the only change the app makes to a
// group chat row.

// Chat rows come with `event` ({ event_title }) attached for group chats, so an
// unlabeled group chat can show the event's current title. `unread_count` is
// how many messages from other people the user hasn't seen, and
// `last_msg_time` the newest message's time (null with no messages). Database
// triggers keep both; markChatRead() clears the count.
const CHAT_COLUMNS = 'chat_id, chat_name, event_id, unread_count, last_msg_time, event:events(event_title)'

// Messages come with `sender` attached, for names in group chats.
const MESSAGE_COLUMNS = 'msg_id, msg_content, msg_time, sender_uid, sender:users(uid, full_name, is_active)'

// The other participant's `users` row for each of the given direct chats, by chat id.
async function otherParticipants(chatIds, uid) {
  if (chatIds.length === 0) return new Map()
  const rows = unwrap(
    await supabase
      .from('chats_list')
      .select('chat_id, user:users(uid, full_name, is_active)')
      .in('chat_id', chatIds)
      .neq('user_id', uid),
  )
  return new Map(rows.map((row) => [row.chat_id, row.user]))
}

// The user's chats with the newest message (`latest`, with `sender`) attached,
// most recently active first (by `last_msg_time`). Direct chats also get the
// other participant (`other`); group chats have `event_id` set instead. Chats
// with no messages are left out, so opening a chat doesn't show up for the
// other person until something is sent. Opening it again finds the same chat.
export async function listChats(uid) {
  const chats = unwrap(
    await supabase
      .from('chats_list')
      .select(CHAT_COLUMNS)
      .eq('user_id', uid)
      .not('last_msg_time', 'is', null)
      .order('last_msg_time', { ascending: false })
      .order('chat_id'),
  )
  if (chats.length === 0) return []
  const directIds = chats.filter((chat) => !chat.event_id).map((chat) => chat.chat_id)
  const [others, latest] = await Promise.all([
    otherParticipants(directIds, uid),
    Promise.all(
      chats.map(async (chat) => {
        const rows = unwrap(
          await supabase
            .from('chat_msgs')
            .select(MESSAGE_COLUMNS)
            .eq('chat_id', chat.chat_id)
            .order('msg_time', { ascending: false })
            .order('msg_id', { ascending: false })
            .limit(1),
        )
        return rows[0] ?? null
      }),
    ),
  ])
  return chats
    .map((chat, i) => ({ ...chat, other: others.get(chat.chat_id) ?? null, latest: latest[i] }))
    .filter((chat) => chat.latest)
}

// Just the user's chats with unread messages ({ chat_id, event_id,
// unread_count }), for the badge on the messages button. Small enough to run
// the whole time the user is logged in.
export async function listUnreadChats(uid) {
  return unwrap(
    await supabase.from('chats_list').select('chat_id, event_id, unread_count').eq('user_id', uid).gt('unread_count', 0),
  )
}

// Marks one of the user's chats as read (unread_count 0). Called on every update
// of the open chat; the database only writes when something was unread.
// Returns whether anything changed, so callers only refresh badges then.
export async function markChatRead(chatId) {
  check(chatId, 'Chat is required.')
  return unwrap(await supabase.rpc('mark_chat_read', { target_chat: chatId }))
}

// Marks all of the user's event chats (`eventChats` true) or direct chats
// (false) as read, for the button on each tab of the chat list. Returns how
// many chats it cleared.
export async function markAllChatsRead({ eventChats }) {
  check(typeof eventChats === 'boolean', 'Pick direct chats or event chats.')
  return unwrap(await supabase.rpc('mark_all_chats_read', { event_chats: eventChats }))
}

// One of the user's chats (direct chats with `other` attached), or null if
// they aren't in it. Leaving an event removes you from its group chat.
export async function getChat(chatId, uid) {
  const chat = unwrap(
    await supabase
      .from('chats_list')
      .select(CHAT_COLUMNS)
      .eq('chat_id', chatId)
      .eq('user_id', uid)
      .maybeSingle(),
  )
  if (!chat) return null
  if (chat.event_id) return { ...chat, other: null }
  const others = await otherParticipants([chatId], uid)
  return { ...chat, other: others.get(chatId) ?? null }
}

// Oldest first, newest 200, each with `sender`.
export async function listMessages(chatId) {
  const rows = unwrap(
    await supabase
      .from('chat_msgs')
      .select(MESSAGE_COLUMNS)
      .eq('chat_id', chatId)
      .order('msg_time', { ascending: false })
      .order('msg_id', { ascending: false })
      .limit(MESSAGE_FETCH_LIMIT),
  )
  return rows.reverse()
}

// Works for direct and group chats: RLS only lets chat members send.
export async function sendMessage({ chatId, senderUid, content }) {
  const text = content?.trim() ?? ''
  check(text, 'Write something first.')
  check(text.length <= MESSAGE_MAX, `Messages must be ${MESSAGE_MAX} characters or less.`)
  check(senderUid, 'Sender is required.')
  unwrap(await supabase.from('chat_msgs').insert({ chat_id: chatId, msg_content: text, sender_uid: senderUid }))
}

// Live updates through Supabase Realtime: calls `onMessage(row)` for each new
// chat_msgs row (plain columns, no `sender`). Realtime checks the msgs_read
// policy for each row, so only messages from the user's own chats arrive;
// `chatId` narrows it to one chat. `onStatus(live)` says whether messages are
// being delivered (it reconnects by itself after a drop). Returns a function
// that unsubscribes.
let messageChannelCount = 0
export function subscribeToMessages({ chatId = null, onMessage, onStatus = () => {} }) {
  let stopped = false
  const report = (live) => {
    if (!stopped) onStatus(live)
  }
  const filter = chatId ? { filter: `chat_id=eq.${chatId}` } : {}
  const channel = supabase
    // Unique names, so two subscriptions never share a channel
    .channel(`chat-msgs-${++messageChannelCount}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_msgs', ...filter }, (payload) => {
      if (!stopped) onMessage(payload.new)
    })
    // SUBSCRIBED can come before the server is listening to the database (e.g.
    // right after Realtime starts), so it only counts as live once the server
    // confirms ("Subscribed to PostgreSQL"). It confirms again after reconnecting.
    .on('system', {}, (message) => {
      if (message.extension === 'postgres_changes') report(message.status === 'ok')
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') report(false)
    })
  return () => {
    stopped = true
    supabase.removeChannel(channel)
  }
}

// Sets the user's own label for a chat (direct or group). A blank name clears
// it (null), so the chat shows the other person's name or the event title.
// Only the user's own row changes; the other participants keep their labels.
export async function renameChat({ chatId, uid, chatName }) {
  const name = chatName?.trim() || null
  check(chatId && uid, 'Chat is required.')
  check(!name || name.length <= CHAT_NAME_MAX, `Chat names must be ${CHAT_NAME_MAX} characters or less.`)
  const rows = unwrap(
    await supabase.from('chats_list').update({ chat_name: name }).eq('chat_id', chatId).eq('user_id', uid).select('chat_id'),
  )
  check(rows.length > 0, 'You’re not in this chat anymore.')
}

// Returns the id of the direct chat between the two users, creating it if
// needed. A new chat has no label (chat_name null) for either person. Only
// direct chats count (`event_id` null): two people in the same event group
// chat still get their own direct chat.
export async function findOrCreateChat({ uid, otherUid }) {
  check(uid && otherUid, 'Both participants are required.')
  check(uid !== otherUid, 'You can’t message yourself.')
  const mine = unwrap(await supabase.from('chats_list').select('chat_id').eq('user_id', uid).is('event_id', null))
  if (mine.length > 0) {
    const shared = unwrap(
      await supabase
        .from('chats_list')
        .select('chat_id')
        .eq('user_id', otherUid)
        .is('event_id', null)
        .in('chat_id', mine.map((chat) => chat.chat_id))
        .limit(1),
    )
    if (shared.length > 0) return shared[0].chat_id
  }

  const chatId = crypto.randomUUID()
  // Your own row goes first: RLS only lets chat members add other participants.
  unwrap(await supabase.from('chats_list').insert({ chat_id: chatId, user_id: uid }))
  const { error } = await supabase.from('chats_list').insert({ chat_id: chatId, user_id: otherUid })
  if (error) {
    await supabase.from('chats_list').delete().eq('chat_id', chatId).eq('user_id', uid)
    throw toError(error)
  }
  return chatId
}

// ---------- notifications ----------
// The database creates these (see docs/main_schema.sql), so the app only reads
// them and marks them as read:
// - event_joined: someone joined your event (trigger on joined_events)
// - event_updated: an event you joined changed time or place; `details` holds
//   the new values (trigger on events)
// - event_deleted: an event you joined was deleted; `event_id` is then null and
//   `event_title` keeps the name (trigger on events)
// - event_reminder: an event you joined starts within the hour, made by
//   create_due_reminders() below

// Newest first. Also creates any reminders that are due, since there's no
// server to run them on a schedule: the bell polls this every few seconds.
export async function listNotifications(uid) {
  // Best effort: if it fails, the list still loads and the next poll retries.
  await supabase.rpc('create_due_reminders')
  return unwrap(
    await supabase
      .from('notifications')
      .select(NOTIFICATION_COLUMNS)
      .eq('recipient_uid', uid)
      .order('create_time', { ascending: false })
      .order('notification_id', { ascending: false })
      .limit(NOTIFICATION_FETCH_LIMIT),
  )
}

export async function markNotificationsRead(uid) {
  unwrap(await supabase.from('notifications').update({ is_read: true }).eq('recipient_uid', uid).eq('is_read', false))
}
