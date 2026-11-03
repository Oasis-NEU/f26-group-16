// Adds example events, posted by the test user, to the Supabase project in .env.
//
//   node --env-file=.env scripts/seed_events.mjs
//
// Signs in with the publishable key, so the RLS rules and CHECK constraints
// apply exactly as they do in the app. Event times are relative to today.
// Titles the test user already posted are skipped, so running it twice is safe.
// Pictures are WebP files in scripts/seed_images (credits in CREDITS.md).

import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

// The shared test account from AGENTS.md → Testing.
const EMAIL = process.env.SEED_EMAIL ?? 'user@example.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'password'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = process.env
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Run with --env-file=.env.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// UNIX seconds for `days` from today at hour:minute, local time.
function at(days, hour, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return Math.floor(date.getTime() / 1000)
}

async function picture(name) {
  const bytes = await readFile(new URL(`./seed_images/${name}.webp`, import.meta.url))
  return `data:image/webp;base64,${bytes.toString('base64')}`
}

const EVENTS = [
  {
    title: 'Pickup Soccer on North Field',
    category: 'sports',
    start: at(1, 16),
    end: at(1, 17, 30),
    location: 'North Field',
    description: 'Casual 7v7, all skill levels. We split teams when we get there. Bring water and a light and a dark shirt.',
  },
  {
    title: 'Midterm Study Jam: Calc & Stats',
    category: 'academic',
    picture: 'study',
    start: at(2, 18),
    end: at(2, 21),
    location: 'Main Library, 2nd floor group study area',
    description:
      'Quiet-ish group studying with a couple of TAs floating around for questions.\n\nWe’ll do practice problems on the whiteboards at 7 and 8. Snacks provided!',
    join: true,
    comments: [{ text: 'Will there be anyone who can help with hypothesis testing?', reply: 'Yes! One of the TAs covers intro stats.' }],
  },
  {
    title: 'Sunset Doubles Tennis Social',
    category: 'sports',
    picture: 'tennis',
    start: at(3, 17, 30),
    end: at(3, 19, 30),
    location: 'Campus Tennis Courts',
    description:
      'Rotating doubles until the lights come on. Beginners welcome; we’ll pair you up with someone who has played before.\n\nWe have a few spare rackets and plenty of balls.',
    comments: [{ text: 'Do I need my own racket?', reply: 'Nope, we have spares. Just bring sneakers.' }],
  },
  {
    title: 'Board Game Night',
    category: 'social',
    start: at(4, 19),
    end: at(4, 22),
    location: 'West Hall Common Room',
    description: 'Catan, Codenames, Ticket to Ride, and whatever you bring. Pizza at 8.',
  },
  {
    title: 'Open Mic Night',
    category: 'arts',
    picture: 'open_mic',
    start: at(6, 19),
    end: at(6, 21, 30),
    location: 'Student Center Lounge',
    description:
      'Music, poetry, comedy, anything goes. Five-minute slots; sign up at the door or just come to watch.',
    join: true,
  },
  {
    title: 'Photography Club Photo Walk',
    category: 'clubs',
    start: at(7, 10),
    end: null,
    location: 'Meet at the Main Quad fountain',
    description: 'A slow loop around campus looking for fall colors. Phones are totally fine, no fancy camera needed.',
  },
  {
    title: 'Career Fair Prep Workshop',
    category: 'career',
    picture: 'career_fair',
    start: at(9, 13),
    end: at(9, 14, 30),
    location: 'Career Center, Room 204',
    description:
      'Get your resume reviewed, practice a 30-second intro, and learn what recruiters actually ask at the fair.',
  },
  {
    title: '24-Hour Hack Night',
    category: 'clubs',
    picture: 'hackathon',
    start: at(12, 18),
    end: at(13, 18),
    location: 'Engineering Building, Room 110',
    description:
      'Build anything in 24 hours with a team of up to four. Workshops for first-timers on Saturday morning, demos and prizes at the end.',
  },
  {
    title: 'Welcome Back Picnic',
    category: 'social',
    start: at(-10, 12),
    end: at(-10, 15),
    location: 'Main Quad',
    description: 'Free food, lawn games, and club tables. (This one already happened; it shows up when you widen the date filter.)',
  },
]

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authError) {
  console.error(`Couldn’t sign in as ${EMAIL}: ${authError.message}`)
  process.exit(1)
}
const uid = auth.user.id

const { data: existing, error: listError } = await supabase.from('events').select('event_title').eq('organizer_uid', uid)
if (listError) throw listError
const taken = new Set(existing.map((row) => row.event_title))

let created = 0
for (const event of EVENTS) {
  if (taken.has(event.title)) {
    console.log(`skip   ${event.title} (already posted)`)
    continue
  }
  const now = Math.floor(Date.now() / 1000)
  const eventId = crypto.randomUUID()
  const { error } = await supabase.from('events').insert({
    event_id: eventId,
    event_title: event.title,
    event_description: event.description,
    create_time: now,
    start_time: event.start,
    end_time: event.end,
    location: event.location,
    organizer_uid: uid,
    category_id: event.category,
    picture_data: event.picture ? await picture(event.picture) : null,
  })
  if (error) throw error

  if (event.join) {
    const { error: joinError } = await supabase.from('joined_events').insert({ event_id: eventId, joiner_uid: uid })
    if (joinError) throw joinError
  }
  for (const [i, comment] of (event.comments ?? []).entries()) {
    const mainId = crypto.randomUUID()
    const rows = [
      { comment_id: mainId, event_id: eventId, comment_content: comment.text, comment_time: now + i * 2, sender_uid: uid },
      { event_id: eventId, comment_content: comment.reply, comment_time: now + i * 2 + 1, sender_uid: uid, replying_to: mainId },
    ]
    for (const row of rows) {
      const { error: commentError } = await supabase.from('event_comments').insert(row)
      if (commentError) throw commentError
    }
  }
  created += 1
  console.log(`added  ${event.title}`)
}

console.log(`\nDone: ${created} added, ${EVENTS.length - created} skipped.`)
await supabase.auth.signOut()
