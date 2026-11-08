-- WARNING: This code will delete existing data
/*
-- Trigger on auth.users (dropping the public tables does not remove it)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Tables, children first. CASCADE also drops their indexes, policies, triggers and foreign keys.
DROP TABLE IF EXISTS chat_msgs CASCADE;
DROP TABLE IF EXISTS chats_list CASCADE;
DROP TABLE IF EXISTS joined_events CASCADE;
DROP TABLE IF EXISTS event_comments CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS event_categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DELETE FROM auth.users;  -- wipes all logins; the signup trigger recreates users rows


-- Leftover tables from earlier versions of the schema
DROP TABLE IF EXISTS event_comments_example CASCADE;
DROP TABLE IF EXISTS chat_msgs_example CASCADE;
DROP TABLE IF EXISTS chat_msgs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
-- */

-- Functions (dropping the tables does not remove them)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_user_reactivation() CASCADE;
DROP FUNCTION IF EXISTS public.check_reply_target() CASCADE;
DROP FUNCTION IF EXISTS public.is_chat_member(TEXT) CASCADE;

-- Optional: also delete the Supabase accounts so auth.users matches the new, empty users table
-- DELETE FROM auth.users;
--
*/
-- #region Main database schema

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

-- Auto create user from Supabase auth
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

-- Table of event categories
CREATE TABLE event_categories(
    category_id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 50)
);

-- Default event categories
INSERT INTO event_categories(category_id, name) VALUES
    ('sports', 'Sports'),
    ('academic', 'Academic'),
    ('arts', 'Arts & Entertainment'),
    ('clubs', 'Clubs'),
    ('social', 'Social'),
    ('career', 'Career');

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

-- #region Row level security

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

-- #region Notifications

-- Notifications shown in the menu bar inbox
CREATE TABLE notifications(
    notification_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recipient_uid TEXT NOT NULL REFERENCES users(uid),
    actor_uid TEXT NOT NULL REFERENCES users(uid),
    event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('event_joined')),
    create_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    is_read BOOLEAN NOT NULL DEFAULT false,
    -- Leaving and rejoining an event doesn't notify the organizer again
    CONSTRAINT uc_notification UNIQUE (recipient_uid, actor_uid, event_id, notification_type)
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_uid, create_time);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Only the trigger below creates notifications, so there's no insert policy
CREATE POLICY notifications_read_own ON notifications FOR SELECT TO authenticated
    USING (recipient_uid = (SELECT auth.uid())::text);
CREATE POLICY notifications_update_own ON notifications FOR UPDATE TO authenticated
    USING (recipient_uid = (SELECT auth.uid())::text)
    WITH CHECK (recipient_uid = (SELECT auth.uid())::text);

-- Users can only mark notifications as read, not change what they say
REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (is_read) ON notifications TO authenticated;

-- Tells the organizer when someone else joins their event.
-- SECURITY DEFINER because the joiner can't write to the organizer's inbox.
CREATE FUNCTION public.notify_event_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_uid, actor_uid, event_id, notification_type)
  SELECT e.organizer_uid, new.joiner_uid, new.event_id, 'event_joined'
  FROM public.events e
  WHERE e.event_id = new.event_id AND e.organizer_uid <> new.joiner_uid
  ON CONFLICT ON CONSTRAINT uc_notification DO NOTHING;
  RETURN new;
END;
$$;
CREATE TRIGGER on_event_joined
  AFTER INSERT ON joined_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_joined();
