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

### Detail page

- Each post includes a picture, title, description & location, category, and the start/end date of the event with the organizer (account) of it
    - If picture not present, use a placeholder glyph instead
- "Join event" button with a display of how many people already joined/subscribed
- Comments with replies
- "Direct message" button to contact the organizer
- If viewing as the event creator, a button that opens an "edit event" page allowing for modifications of these fields

### Personal schedule page

- Shows all events the user has joined in a list, organized by the date of the event
- Each entry shows the event picture, title, and start/end times, and jumps to the detail page when clicked
- The user can remove the event from the join list from this page

### User profile and settings page

- Shows the user profile picture and full name at the center top
- Grid view of the user's event posts with buttons to edit or delete
- Account settings button placed right below the profile picture
  - Settings popup include: change/reset profile picture button, edit full name text field, change password fields (original & new), log out button, delete account button
- Can view other user's profile page by clicking into the account name on event page and comment page (without edit/account settings button)

### Direct messages popup

- List of messages displayed in a menu bar popup on homepage, displaying the chat name and most recent message for each entry
- Each chat supports simple text messages, attempt to fetch latest messages every 2 seconds in the page
- If couldn't connect to server, display a small banner in the popup saying so and retry connection as usual (every 2 seconds)

### Top menu bar

- Website logo on the left
- Navigation buttons for homepage, personal schedule, and user profile pages placed on the right
- Direct messages popup button placed to the adjacent left of the navigation buttons

# Technical details

## Database Schema

- Table of users
    - Name, UID (the one in Supabase), profile picture data
    - Authentication handled by Supabase (no password stored)
    - The row is created by a database trigger on sign-up (see [Supabase Auth](#supabase-auth)), so an account can't exist in Supabase Auth without a `users` row
    - If a user is deleted (`is_active` set to false), it is shown as "Deleted account" in places like comments and direct messages
    - Users can set their own `is_active` to false, but only administrators (SQL editor, Table Editor, or the secret key) can set it back to true
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

All date and time values are represented using UNIX timestamps in seconds. Use a separate library to encode uploaded picture as WebP to support Safari.

### SQL Representation

```sql
-- Image columns hold "data:image/webp;base64,<base64 encoded data>".
-- Max length 13981039 = 23-char prefix + base64 of 10 MiB (4 * ceil(10485760 / 3)).

-- Table of users
CREATE TABLE users(
    uid TEXT PRIMARY KEY, -- Supabase UID
    full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 100),
    profile_pic_data TEXT CHECK (
        profile_pic_data LIKE 'data:image/webp;base64,%'
        AND octet_length(profile_pic_data) <= 13981039
    ),
    is_active BOOLEAN NOT NULL DEFAULT true -- Set to false when account is deleted
    -- (Email and passwords are handled by Supabase)
);

-- Only administrators can reactivate a deleted account. App requests run as the
-- anon/authenticated roles; the SQL editor, Table Editor, and secret key don't.
CREATE FUNCTION prevent_user_reactivation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF OLD.is_active = false AND NEW.is_active = true
        AND current_user IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Only administrators can reactivate a deleted account';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_prevent_user_reactivation BEFORE UPDATE OF is_active ON users
    FOR EACH ROW EXECUTE FUNCTION prevent_user_reactivation();

-- Table of event categories
CREATE TABLE event_categories(
    category_id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 50)
);

-- Table of events created
CREATE TABLE events(
    event_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_title TEXT NOT NULL CHECK (char_length(btrim(event_title)) BETWEEN 1 AND 100),
    event_description TEXT CHECK (char_length(event_description) <= 5000),
    create_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    start_time BIGINT NOT NULL CHECK (start_time > 0),
    end_time BIGINT,
    location TEXT CHECK (char_length(location) <= 200),
    organizer_uid TEXT NOT NULL REFERENCES users(uid),
    category_id TEXT REFERENCES event_categories(category_id),
    picture_data TEXT CHECK (
        picture_data LIKE 'data:image/webp;base64,%'
        AND octet_length(picture_data) <= 13981039
    ),
    CONSTRAINT chk_event_times CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Event comments table
CREATE TABLE event_comments(
    comment_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    comment_content TEXT NOT NULL CHECK (char_length(btrim(comment_content)) BETWEEN 1 AND 2000),
    comment_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    sender_uid TEXT NOT NULL REFERENCES users(uid),
    -- NULL for main comments; replies only reference the main comment (see trigger below)
    replying_to TEXT,
    CONSTRAINT uc_comment_event UNIQUE (comment_id, event_id),
    -- Replies must be on the same event as their main comment, and are deleted with it
    CONSTRAINT fk_reply_parent FOREIGN KEY (replying_to, event_id)
        REFERENCES event_comments(comment_id, event_id) ON DELETE CASCADE,
    CONSTRAINT chk_not_self_reply CHECK (replying_to <> comment_id)
);

-- Reject replies to replies (keeps threads one level deep)
CREATE FUNCTION check_reply_target() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.replying_to IS NOT NULL AND EXISTS (
        SELECT 1 FROM event_comments
        WHERE comment_id = NEW.replying_to AND replying_to IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Replies must reference a main comment';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_check_reply_target BEFORE INSERT OR UPDATE ON event_comments
    FOR EACH ROW EXECUTE FUNCTION check_reply_target();

-- Joined events information (create rows for each user)
CREATE TABLE joined_events(
    event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    joiner_uid TEXT NOT NULL REFERENCES users(uid),
    CONSTRAINT uc_event_joiner UNIQUE (event_id, joiner_uid)
);

-- Chats list information (create rows for each user)
CREATE TABLE chats_list(
    chat_id TEXT NOT NULL,
    -- Defaults to event name; each user can set its own name for reference
    chat_name TEXT NOT NULL CHECK (char_length(btrim(chat_name)) BETWEEN 1 AND 100),
    user_id TEXT NOT NULL REFERENCES users(uid),
    CONSTRAINT uc_chat_user UNIQUE (chat_id, user_id)
);

-- Chat messages table
CREATE TABLE chat_msgs(
    msg_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    chat_id TEXT NOT NULL, -- Foreign key not used since primary key not used in chats_list (by user instead of by chat)
    msg_content TEXT NOT NULL CHECK (char_length(btrim(msg_content)) BETWEEN 1 AND 2000),
    msg_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    sender_uid TEXT NOT NULL REFERENCES users(uid)
);

-- Indexes for common lookups
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_organizer ON events(organizer_uid);
CREATE INDEX idx_comments_event ON event_comments(event_id, comment_time);
CREATE INDEX idx_joined_joiner ON joined_events(joiner_uid);
CREATE INDEX idx_chats_user ON chats_list(user_id);
CREATE INDEX idx_msgs_chat ON chat_msgs(chat_id, msg_time);

-- Default event categories
INSERT INTO event_categories(category_id, name) VALUES
    ('sports', 'Sports'),
    ('academic', 'Academic'),
    ('arts', 'Arts & Entertainment'),
    ('clubs', 'Clubs'),
    ('social', 'Social'),
    ('career', 'Career');
```

### Row-level security

Signed-in users can read shared data; users can only write rows that belong to them. Chats are only visible to their members.

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE joined_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_msgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_read ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY users_insert_own ON users FOR INSERT TO authenticated
    WITH CHECK (uid = (SELECT auth.uid())::text);
CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
    USING (uid = (SELECT auth.uid())::text) WITH CHECK (uid = (SELECT auth.uid())::text);

CREATE POLICY categories_read ON event_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY events_read ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY events_write_own ON events FOR ALL TO authenticated
    USING (organizer_uid = (SELECT auth.uid())::text)
    WITH CHECK (organizer_uid = (SELECT auth.uid())::text);

CREATE POLICY comments_read ON event_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_write_own ON event_comments FOR ALL TO authenticated
    USING (sender_uid = (SELECT auth.uid())::text)
    WITH CHECK (sender_uid = (SELECT auth.uid())::text);

-- Everyone can read joins (needed for joiner counts)
CREATE POLICY joined_read ON joined_events FOR SELECT TO authenticated USING (true);
CREATE POLICY joined_write_own ON joined_events FOR ALL TO authenticated
    USING (joiner_uid = (SELECT auth.uid())::text)
    WITH CHECK (joiner_uid = (SELECT auth.uid())::text);

-- SECURITY DEFINER so chat policies can check membership without recursing into chats_list RLS
CREATE FUNCTION is_chat_member(target_chat TEXT) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM chats_list
        WHERE chat_id = target_chat AND user_id = (SELECT auth.uid())::text
    );
$$;

CREATE POLICY chats_read ON chats_list FOR SELECT TO authenticated
    USING (is_chat_member(chat_id));
-- Add your own row first, then rows for the other participants
CREATE POLICY chats_insert ON chats_list FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid())::text OR is_chat_member(chat_id));
CREATE POLICY chats_update_own ON chats_list FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())::text) WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY chats_delete_own ON chats_list FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY msgs_read ON chat_msgs FOR SELECT TO authenticated
    USING (is_chat_member(chat_id));
CREATE POLICY msgs_insert ON chat_msgs FOR INSERT TO authenticated
    WITH CHECK (sender_uid = (SELECT auth.uid())::text AND is_chat_member(chat_id));
```

### Supabase Auth

Users sign up and log in with their email and password through Supabase Auth. `users.uid` is the Supabase Auth user id, so the RLS rules above can compare it with `auth.uid()`.

Dashboard setting (Authentication → Sign In / Providers → **Email**):

- Email provider: **on**
- Confirm email: **off for now**. Supabase's built-in email service only delivers to members of the Supabase project and sends just a few emails per hour. Turn it back on once a custom SMTP sender is set up (Authentication → Emails → SMTP Settings). The app handles both: with it on, sign-up shows "Check your inbox".

Sign-up trigger: creates the `users` row when someone signs up. `full_name` comes from the sign-up form's metadata.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF coalesce(trim(new.raw_user_meta_data->>'full_name'), '') = '' THEN
    RAISE EXCEPTION 'full_name is required';
  END IF;

  INSERT INTO public.users (uid, full_name, is_active)
  VALUES (new.id::text, trim(new.raw_user_meta_data->>'full_name'), true);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Migration steps from the first auth version and troubleshooting are in `docs/auth-setup.md`.

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

## Data functions

Design appropriate functions for inserting values into the database and fetching records based on the example above (perform SQL queries on the Supabase server). Put them into a separate file (e.g. `src/api.jsx`) for organization and clarity. Implement relevant data validation and checks (e.g. title length, required fields, end_time >= start_time, image size/type limits) to prevent bad data from being written.

Auth functions in `src/api.jsx`:

| Function | What it does |
|---|---|
| `signUp({ email, fullName, password, confirmPassword })` | Validates, then creates the account. The sign-up trigger creates the `users` row. |
| `logIn(email, password)` | Logs in. The session is saved in the browser until logout. |
| `logOut()` | Logs out (for the account settings popup) |
| `onSessionChange(callback)` | Lets `App.jsx` switch between the login page and the app |
| `getProfile(authId)` | The `users` row for the logged-in account (`uid` = `authId`) |

If `is_active` is false, `App.jsx` logs the user straight back out and shows "This account has been deleted."

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
  App.jsx                   # Core app logic
  api.jsx                   # Functions for reading/modifying the database
  pages/
    intro_page.jsx          # Introduction page before logging in
    login_page.jsx          # User login and create account page
    homepage.jsx            # Homepage showing the available events
    event_detail.jsx        # Event detail page
    edit_event.jsx          # Edit event page
    schedule.jsx            # Personal schedule (joined events) page
    account_profile.jsx     # Current user profile + account settings popup
  components/
    EventCard.jsx           # event item in homepage & account profile display
    Logo.jsx                # SVG tennis racket logo with wind trails
    menu_bar.jsx            # Top menu bar
    messages_popup.jsx      # Popup view for direct messages
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
