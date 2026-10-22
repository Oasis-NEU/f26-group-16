# AGENTS.md — Rally landing page

Guidance for AI coding agents working on this repo. Follow these conventions so new work matches the existing page.

# Product features

## Overview

Rally is a public event board for college campuses. Students and clubs post events, and others comment on them or message the organizer. Every post has:

- a cover **picture**
- a **title**
- a **description**
- a **start and end** date/time
- a location and organizer

The platform is open to any campus event: study sessions, club meetings, open mics, and so on. Others can join/subscribe to the event (with the number of subscribers displayed on the page), comment on the post, or reach out to the organizer directly (e.g. in-platform direct message, contact info).

## Interface Functions

### Create account page

- Each user is randomly assigned a 10-digit UID which serves as the username
- Password text field with confirmation

### Homepage

- Displayed when the user is logged in
- The home page lists the available events in a grid view, detailing the picture, title, date, and organizer of the event
- The user can choose different categories (e.g. sport, entertainment) to filter events
    - Additional filters like date range

### Detail page

- Each post includes a picture, title, description, and the start/end date of the event
- "Join event" button with a display of how many people already joined/subscribed
- Comments with replies
- "Direct message" button to contact the organizer

### Personal schedule page

- Shows all events the user has joined in a list, organized by the date of the event
- Each entry shows the event picture, title, and start/end times, and jumps to the detail page when clicked
- The user can remove the event from the join list from this page

### User profile and settings page

- Shows the user profile picture and full name at the center top
- Grid view of the user's event posts with buttons to edit or delete
- Account settings button placed right below the profile picture
  - Settings popup include: change/reset profile picture button, edit full name text field, change password fields (original & new), log out button, delete account button

### Direct messages page

- List of messages displayed in a menu bar popup on homepage, displaying the chat name and most recent message for each entry
- Each chat supports simple text messages, attempt to fetch latest messages every 2 seconds in the page

### Top menu bar

- Website logo on the left
- Navigation buttons for homepage, personal schedule, and user profile pages placed on the right
- Direct messages popup button placed to the adjacent left of the navigation buttons

# Technical details

## Database Schema

- Table of users
    - Name, SHA-256 hashed password, 10-digit UID, profile picture data
    - If a user is deleted, it is shown as "Deleted account" in comments and direct messages (represented as NULL in database)
- Table of event categories
    - Category ID, name
- Table for events created
    - Title, picture (encoded in base64 data URL), start & end date, organizer UID, unique event ID, category
- Tables for comments under each post (labeled with event ID)
    - Comment content, sender UID, comment ID, replying comment ID, date
- Table for "joined events" information
    - Event ID and UID for each user joined
- Tables for direct messages
    - Create individual tables for each chat (message ID, message content, date, sender) labeled with chat ID
        - Fetch chat list: Query chats based on UID → Query participant UIDs based on chat ID
    - Use another table for lists of chats (chat ID, UID, user-defined name/label); separate entries for each user

(All date and time values are represented using UNIX timestamps.)

### SQL Representation

```sql
-- Table of users
CREATE TABLE users(
    uid TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    pwd_hash TEXT NOT NULL, -- SHA-256 hash
    -- Image file encoded in "data:image/<format>;base64,<base64 encoded data>"
    profile_pic_data TEXT
);

-- Table of event categories
CREATE TABLE event_categories(
    category_id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
-- Table of events created
CREATE TABLE events(
    event_id TEXT PRIMARY KEY,
    event_title TEXT NOT NULL,
    event_description TEXT,
    create_time BIGINT NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    organizer_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    category_id TEXT REFERENCES event_categories(category_id),
    -- Image file encoded in "data:image/<format>;base64,<base64 encoded data>"
    picture_data TEXT
);

-- [Create for each event] (UUID represents event ID)
CREATE TABLE event_comments_UUID(
    comment_id TEXT PRIMARY KEY,
    comment_content TEXT NOT NULL,
    comment_time BIGINT NOT NULL,
    sender_uid TEXT REFERENCES users(uid) ON DELETE SET NULL,
    -- All replies are deleted when the main comment is deleted; only reference the main comment
    replying_to TEXT REFERENCES event_comments_UUID(comment_id) ON DELETE CASCADE
);

-- Joined events information by user
CREATE TABLE joined_events(
    event_id TEXT NOT NULL,
    joiner_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE
);

-- Chats list information by user
CREATE TABLE chats_list(
    chat_id TEXT NOT NULL,
    -- Defaults to event name; each user can set its own name for reference
    chat_name TEXT NOT NULL, 
    user_id TEXT REFERENCES users(uid) ON DELETE SET NULL
);

-- [Create for each chat] (UUID represents chat ID)
CREATE TABLE chat_msgs_UUID(
    msg_id TEXT PRIMARY KEY,
    msg_content TEXT NOT NULL,
    msg_time BIGINT NOT NULL,
    sender_uid TEXT REFERENCES users(uid) ON DELETE SET NULL
);
```

### Example commands for fetching records

```sql
-- Fetch list of events
SELECT * FROM events ORDER BY start_date DESC;

-- Fetch number of event joiners for an event
SELECT COUNT(joiner_uid) FROM joined_events WHERE event_id=<id>;

-- Fetch events that the user has joined
SELECT event_id FROM joined_events WHERE joiner_uid=<id>;

-- Fetch comments for an event post
SELECT * FROM event_comments_<Event ID>;

-- Fetch list of chats for a user
SELECT chat_id, chat_name FROM chats_list WHERE user_id=<id>;

-- Fetch message list
SELECT * FROM chat_msgs_<Chat ID>;
```

## Stack

- React 18 (function components and hooks only)
- Vite 6
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
  App.jsx                   # Core app logic
  intro_page.jsx            # Introduction page before logging in
  login_page.jsx            # User login and create account page
  homepage.jsx              # Homepage showing the available events
  event_detail.jsx          # Event detail page
  schedule.jsx              # Personal schedule (joined events) page
  messages_popup.jsx        # Popup view for direct messages
  account_profile.jsx       # Current user profile + account settings popup
  components/
    EventCard.jsx           # reusable event post card
    Logo.jsx                # SVG tennis racket logo with wind trails
    menu_bar.jsx            # Top menu bar
```

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
