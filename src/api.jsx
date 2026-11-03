// Read/write functions for the Supabase database. Pages call these instead of
// using the client directly. Every function throws an Error on bad input or a
// failed query, so callers can wrap them in try/catch.
//
// Times are stored as UNIX timestamps in seconds (BIGINT columns).
//
// Not here yet: direct messages (chats_list, chat_msgs). Add them alongside
// the messages popup.

import { supabase } from './utils/supabase.js'

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 5000
export const LOCATION_MAX = 200
export const COMMENT_MAX = 2000
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024

// Pictures are stored as WebP data URLs. The length limit matches the CHECK
// rule on picture columns: the prefix plus the base64 of 10 MiB.
const WEBP_PREFIX = 'data:image/webp;base64,'
const IMAGE_DATA_URL_MAX = WEBP_PREFIX.length + 4 * Math.ceil(IMAGE_MAX_BYTES / 3)

const nowSeconds = () => Math.floor(Date.now() / 1000)

// Columns the app reads from `users`.
const USER_COLUMNS = 'uid, full_name, profile_pic_data, is_active'

// Event rows come with `organizer` ({ uid, full_name, is_active }) and
// `category` ({ category_id, name }, or null) attached.
const EVENT_COLUMNS = '*, organizer:users(uid, full_name, is_active), category:event_categories(category_id, name)'

// Comment rows come with `sender` ({ uid, full_name, is_active }) attached.
const COMMENT_COLUMNS = '*, sender:users(uid, full_name, is_active)'

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

export function validateEvent({ title, description, location, startTime, endTime, pictureData }) {
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
// Returns a function that stops listening.
export function onSessionChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// The `users` row for a logged-in Supabase Auth user (uid = Auth user id).
export async function getProfile(authId) {
  return getUser(authId)
}

// ---------- users ----------

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

// Soonest first. Filters are optional: categoryId, and a [from, to] window on
// start_time.
export async function listEvents({ categoryId, from, to } = {}) {
  let query = supabase.from('events').select(EVENT_COLUMNS)
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

export async function createEvent({ title, description, location, startTime, endTime, organizerUid, categoryId, pictureData }) {
  validateEvent({ title, description, location, startTime, endTime, pictureData })
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
  }
  return unwrap(await supabase.from('events').insert(row).select(EVENT_COLUMNS).single())
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
  }
  validateEvent(merged)
  const row = {
    event_title: merged.title.trim(),
    event_description: merged.description?.trim() || null,
    location: merged.location?.trim() || null,
    start_time: merged.startTime,
    end_time: merged.endTime,
    picture_data: merged.pictureData,
  }
  if (changes.categoryId !== undefined) row.category_id = changes.categoryId || null
  return unwrap(await supabase.from('events').update(row).eq('event_id', eventId).select(EVENT_COLUMNS).single())
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

export async function hasJoined(eventId, uid) {
  const rows = unwrap(
    await supabase.from('joined_events').select('event_id').eq('event_id', eventId).eq('joiner_uid', uid).limit(1),
  )
  return rows.length > 0
}

export async function joinEvent(eventId, uid) {
  const { error } = await supabase.from('joined_events').insert({ event_id: eventId, joiner_uid: uid })
  // 23505 = unique violation, i.e. already joined. Treat that as success.
  if (error && error.code !== '23505') throw toError(error)
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
