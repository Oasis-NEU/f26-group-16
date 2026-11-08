# AGENTS.md — Rally landing page

Guidance for AI coding agents working on this repo. Follow these conventions so new work matches the existing page.

# Product features

## Overview

Rally is a public event board for college campuses. Students and clubs post events, and others comment on them or message the organizer. Every post has:

- a cover **picture**
- a **title**
- a **description**
- **event date/time** (end time is optional)
- a location and organizer

The platform is open to any campus event: study sessions, club meetings, open mics, and so on. Others can join/subscribe to the event (with the number of subscribers displayed on the page), comment on the post, or reach out to the organizer directly (e.g. in-platform direct message, contact info).

## Interface Functions

### Create account page

- Text field to enter email address
    - (The email must not be used by another user)
- Text field to enter full name
- 2 password text fields (second one for confirmation)

### Login page

- Prompt for the email and password
- If user is deleted (`is_active` is false), display an error message saying so
- Use session token (keep login state until manually logged out)

### Homepage

- Displayed when the user is logged in
- The home page lists the available events in a grid view, detailing the picture, title, date, and organizer (account) of the event
- The user can choose different categories (e.g. sport, entertainment) to filter events
    - Additional filters like date range
- "Post an event" button that opens the edit event page in create mode (same form, empty)

### Detail page

- Each post includes a picture, title, description & location, category, and the start/end date of the event with the organizer (account) of it
    - If picture not present, use a placeholder glyph instead
- "Join event" button with a display of how many people already joined/subscribed
- Comments with replies
- "Direct message" button to contact the organizer
- "Who's going" list of people who joined, each with a message button to chat with them directly (not shown for yourself or deleted accounts)
- If viewing as the event creator, a button that opens an "edit event" page allowing for modifications of these fields

### Personal schedule page

- Shows the events the user has joined on a week calendar (Sunday–Saturday) with hourly timeslots
    - "‹" / "This week" / "›" buttons move between weeks; the week label (e.g. "Nov 8 – 14") sits next to them
    - Each event is a block placed at its start/end time. Events without an end time are drawn as 1 hour long. Overlapping events sit side by side
    - Joined events that overlap each other get a red outline and a ⚠️
    - Past events are faded, and a red line marks the current time on today's column
    - The time range is 8 AM–10 PM by default and grows to fit earlier or later events
    - Hour rows shrink with the window (between 1.25rem and 3rem) so the whole week fits on one screen without scrolling
    - Below `sm`, one day column shows at a time, picked from a strip of day buttons. A solid dot under a day means it has joined events; a hollow dot means it has suggestions only
- Each block shows the title and time (tall blocks also show the event picture), and jumps to the detail page when clicked
    - Short or side-by-side blocks show the title and start time on one line
    - Hovering a block with the mouse for 0.3s (or focusing it with the keyboard) opens a small details popup next to it: picture (or category glyph), date and time, title, organizer, location, description (up to 4 lines), and any overlap warning
        - The popup is hoverable: the mouse can move from the block onto it (there's a 150ms grace period for the gap), and it stays open while hovered. It closes once the pointer has left both the block and the popup, or on Escape or scroll/resize. On touch screens a tap goes straight to the detail page
        - A full-width button at the bottom joins or leaves the event: "＋ Join event" (primary) on suggestions, "Leave event" (secondary) on joined events. It uses the large button style, slightly smaller below `sm`. After joining, the popup stays open and switches to "Leave event"
        - It resizes with the screen: 18rem wide (never wider than the screen) on phones, `w-80` from `sm`, `w-96` from `lg`, with the picture, padding, and title growing to match. It always stays inside the viewport
- The user can remove an event from the join list with the × button on its block
- If the week has no joined events, a status line says so, with a "Jump to your next event" button (or a link to browse events if the user hasn't joined anything)
- "Suggest events" switch: off by default, held only in page state (not saved in the database or browser storage), so it's off again on every visit
    - While on, events that fit the user's open time show as dashed blocks in that week, with a "+" button that joins the event
    - Open time is any time not taken by a joined event (there is no availability table). A suggestion must not overlap a joined event, not be organized by the user, not be joined already, and not have started
    - At most 8 suggestions per week. Categories the user joins most come first, then the soonest
    - Suggestions are fetched per week only while the switch is on, and reused when toggling or returning to a week. Past weeks get none
- Joining and removing update the calendar right away and roll back with an error message if the request fails

### User profile and settings page

- Accessible through the user profile button in the menu bar
    - List popup containing "My profile" and "Account settings" buttons
- User profile page:
    - Shows the user profile picture and full name at top left, placing profile pic and name side by side
    - Grid view of the user's event posts 
        - Edit and delete post buttons if viewing their own profile
- Account settings page include: change/reset profile picture button, edit full name text field, change password fields (original & new), log out button, delete account button
- Can view other user's profile page by clicking into the account name on event page, comments, and direct messages

### Direct messages popup

- List of messages displayed in a menu bar popup on homepage, displaying the chat name and most recent message for each entry
- Each chat supports simple text messages, attempt to fetch latest messages every 2 seconds in the page
- If couldn't connect to server, display a small banner in the popup saying so and retry connection as usual (every 2 seconds)
- The popup has two views: the chat list, and one open chat with its messages and a text field. Polling only runs while the popup is open
- The "Direct message" button on the detail page opens the popup on the chat with the organizer, creating it first if needed. The message buttons in the "Who's going" list do the same for that person
- Chats with no messages don't appear in the list, for either person. Opening a chat doesn't notify the other person; they see it once a message is sent
- Two users share one chat. A new chat is named after the event it started from, and later messages about other events go in the same chat
- Deleted accounts show as "Deleted account"; their chats stay readable, but the text field is replaced by a note that you can't reply

### Notification inbox

- Bell button in the menu bar with a badge showing the number of unread notifications (updates every 5 seconds)
- Popup lists the newest 30 notifications, each saying what happened and when, and links to the event
- For now the only notification is "<name> joined <event>", sent to the organizer. Joining your own event sends nothing, and leaving and rejoining doesn't notify again
- Opening the popup marks everything as read; those stay highlighted until it closes
- If couldn't connect to server, display a small banner in the popup saying so and keep retrying

### Action confirmations

- A short message appears at the bottom of the screen for 3 seconds when an action works, so people know it went through
- Used for: joining and leaving an event, posting a comment or reply, posting an event, and saving event changes. Call `showToast(message)` from `src/utils/toast.js` for new actions
- Failures don't use it: they stay next to the form as an `ErrorMessage`
- Not needed when the result is already obvious, like a sent message appearing in the chat

### Top menu bar

- Website logo on the left
- Navigation buttons for homepage, personal schedule, and user profile pages placed on the right
- Direct messages popup button placed to the adjacent left of the navigation buttons
- Notification inbox button placed to the adjacent left of the direct messages button

# Technical details

## Database Schema

- Table of users
    - Name, UID (the one in Supabase), profile picture data
    - Authentication handled by Supabase (no password stored)
    - The row is created by a database trigger on sign-up (see [Supabase Auth](#supabase-auth)), so an account can't exist in Supabase Auth without a `users` row
    - If a user is deleted (`is_active` set to false), it is shown as "Deleted account" in places like comments and direct messages
        - Users can set their own `is_active` to false, but only administrators (SQL editor, Table Editor, or the secret key) can set it back to true
        - Delete the entry from Supabase auth table so the same email can be used to create a new account (the `trg_delete_auth_user_on_deactivate` trigger does this)
        - Their events are left out of event listings (homepage, schedule suggestions) but still open by direct link
        - To restore an account, an administrator re-links the old row to the person's new login (see `docs/auth-setup.md`); `ON UPDATE CASCADE` carries the uid change to every table
    - Backend validation: Picture size ≤ 10MB (compress & encode uploaded file to WebP)
- Table of event categories
    - Category ID, name
- Table for events created
    - Title, picture (encode as WebP at 1920x1080 max), start & end date, organizer UID, unique event ID, category
    - Backend validation: Title ≤ 100 chars; prevent user from choosing end date earlier than start date, etc.
- Table for comments
    - Each entry contains the event ID which the comment belongs to
    - Comment content, sender UID, comment ID, replying comment ID, date
- Table for "joined events" information
    - Event ID and UID for each user joined
- Tables for direct messages
    - Create table for chat messages (message ID, message content, date, sender) labeled with its belonging chat ID
        - Fetch chat list: Query chats based on UID → Query participant UIDs based on chat ID
    - Use another table for lists of chats (chat ID, UID, user-defined name/label); separate entries for each user
- Table for notifications
    - Notification ID, recipient UID, actor UID (who did it), event ID, type, date, read flag
    - Rows are only created by the `on_event_joined` database trigger. Users can read their own and change only `is_read`

All date and time values are represented using UNIX timestamps in seconds. Use a separate library to encode uploaded picture as WebP to support Safari.

### SQL Representation

SQL representation of the database can be found in the `docs/main_schema.sql` file. Example data can be found in the `docs/example_data.sql` file. `docs/notifications.sql` adds notifications to a database that already has the rest of the schema, keeping its data.

### Supabase Auth

Users sign up and log in with their email and password through Supabase Auth. `users.uid` is the Supabase Auth user id, so the RLS rules above can compare it with `auth.uid()`.

Dashboard setting (Authentication → Sign In / Providers → **Email**):

- Email provider: **on**
- Confirm email: **off for now**. Supabase's built-in email service only delivers to members of the Supabase project and sends just a few emails per hour. Turn it back on once a custom SMTP sender is set up (Authentication → Emails → SMTP Settings). The app handles both: with it on, sign-up shows "Check your inbox".

Sign-up trigger: creates the `users` row when someone signs up. `full_name` comes from the sign-up form's metadata. The `handle_new_user` trigger can be found in the `docs/main_schema.sql` file.

(Migration steps from the first auth version and troubleshooting are in `docs/auth-setup.md`.)

### Example commands for fetching records

```sql
-- Fetch list of events
SELECT * FROM events ORDER BY start_time DESC;

-- Fetch number of event joiners for an event
SELECT COUNT(joiner_uid) FROM joined_events WHERE event_id=<id>;

-- Fetch events that the user has joined
SELECT event_id FROM joined_events WHERE joiner_uid=<id>;

-- Fetch comments for an event post
SELECT * FROM event_comments WHERE event_id=<id> ORDER BY comment_time;

-- Fetch list of chats for a user
SELECT chat_id, chat_name FROM chats_list WHERE user_id=<id>;

-- Fetch message list
SELECT * FROM chat_msgs WHERE chat_id=<id> ORDER BY msg_time;
```

## Testing

Use username: `user@example.com`; password: `password` for interface testing.

To fill an empty database with example events (posted by the test user, some with pictures, comments, and joins), run `node --env-file=.env scripts/seed_events.mjs`. It skips events that already exist, so running it twice is safe.

## Data functions

Design appropriate functions for inserting values into the database and fetching records based on the example above (perform SQL queries on the Supabase server). Put them into a separate file (e.g. `src/api.jsx`) for organization and clarity. Implement relevant data validation and checks (e.g. title length, required fields, end_time >= start_time, image size/type limits) to prevent bad data from being written.

Auth functions in `src/api.jsx`:

| Function | What it does |
|---|---|
| `signUp({ email, fullName, password, confirmPassword })` | Validates, then creates the account. The sign-up trigger creates the `users` row. |
| `logIn(email, password)` | Logs in. The session is saved in the browser until logout. |
| `logOut()` | Logs out (menu bar and account settings page) |
| `onSessionChange(callback)` | Lets `App.jsx` switch between the login page and the app |
| `getProfile(authId)` | The `users` row for the logged-in account (`uid` = `authId`) |
| `updateProfile(uid, { fullName, pictureData })` | Changes the name and/or picture (`null` removes it; pictures fit 512x512) and returns the updated row |
| `changePassword({ currentPassword, newPassword, confirmPassword })` | Checks the current password by logging in again, then sets the new one |
| `deleteAccount(uid, password)` | Checks the password, sets `is_active` to false (the trigger removes the login), and clears the session |

If `is_active` is false, `App.jsx` logs the user straight back out and shows "This account has been deleted." (After a deletion the login itself is gone, so logging in again just says "Wrong email or password".)

Notification functions in `src/api.jsx`:

| Function | What it does |
|---|---|
| `listNotifications(uid)` | The user's newest 30 notifications with `actor` and `event` attached, newest first |
| `markNotificationsRead(uid)` | Marks all of the user's unread notifications as read |

Direct message functions in `src/api.jsx`:

| Function | What it does |
|---|---|
| `listChats(uid)` | The user's chats that have messages, with `other` (the other participant) and `latest` (the newest message) attached, most recently active first |
| `getChat(chatId, uid)` | One of the user's chats with `other` attached, or `null` if they aren't in it |
| `listMessages(chatId)` | A chat's newest 200 messages, oldest first |
| `sendMessage({ chatId, senderUid, content })` | Validates (1–2000 characters), then sends a message |
| `findOrCreateChat({ uid, otherUid, chatName })` | Returns the id of the two users' chat, creating it if needed. Adds your own `chats_list` row first, because RLS only lets chat members add other participants |

## Stack

- React 19 (function components and hooks only)
- Vite 8
- Tailwind CSS v4 via `@tailwindcss/vite`. There is **no** `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme`.
- No router, state library, or UI kit. Don't add dependencies unless the task needs them.

The following commands can be used:

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # must pass before you finish
```

## Project layout

The core components of the project are detailed as follows. Other files and parts can be added as needed.

```
index.html                  # page shell + inline script that applies dark mode before first paint
src/
  main.jsx                  # React entry
  index.css                 # Tailwind import, theme tokens, dark overrides, logo animation
  App.jsx                   # Core app logic: session check, menu bar, page for the current route
  api.jsx                   # Functions for reading/modifying the database
  pages/
    intro_page.jsx          # Introduction page before logging in
    login_page.jsx          # User login and create account page
    homepage.jsx            # Homepage showing the available events
    event_detail.jsx        # Event detail page
    edit_event.jsx          # Edit event page (also creates new events)
    schedule.jsx            # Personal schedule (joined events) page
    account_profile.jsx     # User profile: picture, name, and posted events (edit/delete on your own)
    account_settings.jsx    # Account settings: picture, name, password, log out, delete account
  components/
    EventCard.jsx           # event item in homepage & account profile display
    Avatar.jsx              # round profile picture, or the name's first letter
    UserName.jsx            # name linking to the user's profile ("Deleted account" for deleted users)
    EventPicture.jsx        # event picture, or the category glyph when there is none
    WeekCalendar.jsx        # week grid with hourly timeslots for the schedule page
    EventPopover.jsx        # hover/focus details popup for schedule calendar blocks
    Logo.jsx                # SVG tennis racket logo with wind trails
    menu_bar.jsx            # Top menu bar
    messages_popup.jsx      # Messages button + popup: chat list, open chat, 2-second polling
    notifications_popup.jsx # Bell button + unread badge + notification list
    toaster.jsx             # Shows showToast() confirmations at the bottom of the screen
    ui.jsx                  # shared button/input styles, ErrorMessage, Notice
  utils/
    supabase.js             # Supabase client (only api.jsx imports it)
    routes.js               # hash routes: path builders, useRoute(), navigate()
    format.js               # dates, "Deleted account" names, category glyphs
    chat_events.js          # openChat(chatId): opens the messages popup from any page
    use_dismiss.js          # useDismiss(): closes a popup on Escape or an outside click
    use_polling.js          # usePolling(): re-fetches data on a timer, keeps it through failures
    toast.js                # showToast(message): confirms an action from any page
    schedule.js             # schedule helpers: overlaps, conflicts, suggestions, block time labels
    calendar.js             # week calendar math: week start, day clipping, side-by-side layout
scripts/
  seed_events.mjs           # example events for testing
  seed_images/              # WebP pictures for the example events (credits in CREDITS.md)
```

### Routes

There's no router library. Pages are picked from the URL hash in `App.jsx`, and links use the builders in `src/utils/routes.js` (e.g. `<a href={eventPath(id)}>`) instead of writing hashes by hand.

| Hash | Page |
|---|---|
| `#/` | Homepage |
| `#/event/new` | Edit event page, create mode |
| `#/event/<event_id>` | Detail page |
| `#/event/<event_id>/edit` | Edit event page |
| `#/schedule` | Personal schedule |
| `#/profile` | Your profile |
| `#/profile/<uid>` | Someone else's profile |
| `#/settings` | Account settings |

Add new pages as a case in `currentPage()` in `App.jsx`.

# Appearance and design

## Theme: tennis court, green and white

Colors come from tokens in `src/index.css`. **Never hard-code `slate-*`, `gray-*`, `bg-white`, or hex values in components.** Use the tokens below so dark mode keeps working.

| Token | Use for | Light | Dark |
|---|---|---|---|
| `page` | page background | `#ffffff` | `#0b1711` |
| `surface` | cards, inputs, pills | `#ffffff` | `#12231a` |
| `ink` | headings, primary text | `#0f172a` | `#e8f3ec` |
| `muted` | body and secondary text | `#475569` | `#9db4a6` |
| `line` | borders, dividers, placeholders | `#e2e8f0` | `#22382b` |
| `brand-50` | tinted section backgrounds | `#f0f8f2` | `#10241a` |
| `brand-100` | badges, soft fills | `#d9efdf` | `#173524` |
| `brand-500` | primary buttons, accent text | `#2e8b57` | same |
| `brand-600` | hover states, links, dates | `#24744a` | `#4cbb7c` |
| `brand-700` | court section background, solid buttons | `#1c5d3b` | same |
| `brand-900` | darkest accent | `#123d27` | `#0a2216` |

Examples: `bg-page`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-brand-500 hover:bg-brand-600`.

- Dark mode is class-based (`.dark` on `<html>`), declared with `@custom-variant dark` in `index.css`. To add a new color, define it in `@theme` **and** override it in the `.dark` block.
- Use `dark:` utilities only for one-off fixes, such as `dark:text-brand-600` on the hero badge.
- `bg-white` and `text-white` are fine **only** on top of fixed green fills (buttons, the "How it works" court section, the CTA box, logo strokes).

## Layout and components

- Container: `mx-auto max-w-6xl px-4 sm:px-6`. Section padding is `py-20`, or `py-16` for lighter bands.
- Corners: `rounded-lg` (small buttons) · `rounded-xl` (large buttons, inputs, icon tiles) · `rounded-2xl` (cards) · `rounded-3xl` (CTA panel) · `rounded-full` (pills, badges).
- Headings: `text-3xl font-extrabold tracking-tight sm:text-4xl` for sections and `text-4xl … lg:text-6xl` for the hero.
- Primary button: `rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-brand-600`.
- Secondary button: `rounded-xl border border-line bg-surface px-6 py-3 font-semibold text-ink hover:bg-brand-50`.
- Cards: `rounded-2xl border border-line bg-surface shadow-sm`, lifting on hover (`hover:-translate-y-1 hover:shadow-lg`).
- Icons are emoji in a `bg-brand-50` rounded tile. Don't add an icon library unless asked.
- Mobile-first: the page must work at 375px wide with no horizontal scroll. The navbar collapses into a ☰ menu below `md`.

## Signature details (keep these)

- **Logo** (`Logo.jsx`): an upright white tennis racket centered on a `bg-brand-500` tile, with three wind trails on its left. When the parent `.group` is hovered, it winds up and **swings down** around the handle (`racket-swing` keyframes in `index.css`), and the trails streak in. Respect `prefers-reduced-motion`.
- **Court lines** (`CourtLines` in `App.jsx`): faint white SVG court markings behind the "How it works" section.

## Accessibility

- Decorative SVGs get `aria-hidden="true"`. Icon-only buttons get an `aria-label`.
- The entire interface supports dark mode (based on current browser settings)
- Inputs without visible labels need an `aria-label`.
- Animations must be disabled under `prefers-reduced-motion: reduce`.

# Finalizing each change

1. Run `npm run build`, and it must succeed.
2. Check the page in **both** light and dark mode, at desktop width and at 375px.
3. Make sure no new hard-coded neutral colors slipped in:

   ```bash
   grep -rnE '(text|bg|border|ring|from|to)-(slate|gray)-[0-9]|bg-white' src
   ```
