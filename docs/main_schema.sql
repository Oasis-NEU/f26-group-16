-- WARNING: This code will delete existing data, uncomment to run
/*
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS event_categories CASCADE;
DROP TABLE IF EXISTS event_comments CASCADE;
DROP TABLE IF EXISTS joined_events CASCADE;
DROP TABLE IF EXISTS chat_msgs CASCADE;
DROP TABLE IF EXISTS chats_list CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
-- DELETE FROM auth.users;  -- wipes all logins; the signup trigger recreates users rows

-- Leftover tables from earlier versions of the schema
DROP TABLE IF EXISTS event_comments_example CASCADE;
DROP TABLE IF EXISTS chat_msgs_example CASCADE;
-- */

-- Image columns hold "data:image/webp;base64,<base64 encoded data>".
-- Max length 13981039 = 23-char prefix + base64 of 10 MiB (4 * ceil(10485760 / 3)).

-- #region Users list
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
CREATE OR REPLACE FUNCTION prevent_user_reactivation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF OLD.is_active = false AND NEW.is_active = true
        AND current_user IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Only administrators can reactivate a deleted account';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_prevent_user_reactivation BEFORE UPDATE OF is_active ON users
    FOR EACH ROW EXECUTE FUNCTION prevent_user_reactivation();

-- Deleting an account (is_active true -> false) also deletes its Supabase Auth
-- login, so the same email can sign up again. The users row stays, so the
-- account's comments and messages still show as "Deleted account".
-- SECURITY DEFINER because app requests can't write to auth.users. OLD.uid is
-- the login to remove, even if an admin changes uid in the same update.
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM auth.users WHERE id::text = OLD.uid;
    RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER trg_delete_auth_user_on_deactivate AFTER UPDATE OF is_active ON public.users
    FOR EACH ROW WHEN (OLD.is_active AND NOT NEW.is_active)
    EXECUTE FUNCTION public.delete_auth_user_on_deactivate();

-- Auto create user from Supabase auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Fall back to "user_" + the first 8 characters of the uid when no name is given
  INSERT INTO public.users (uid, full_name, is_active)
  VALUES (
    new.id::text,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      'user_' || left(new.id::text, 8)
    ),
    true
  );
  RETURN new;
END;
$$;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- #region Event categories
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

-- #region Event entries
CREATE TABLE events(
    event_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_title TEXT NOT NULL CHECK (char_length(btrim(event_title)) BETWEEN 1 AND 100),
    event_description TEXT CHECK (char_length(event_description) <= 5000),
    create_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    start_time BIGINT NOT NULL CHECK (start_time > 0),
    end_time BIGINT,
    location TEXT CHECK (char_length(location) <= 200),
    organizer_uid TEXT NOT NULL REFERENCES users(uid) ON UPDATE CASCADE,
    category_id TEXT REFERENCES event_categories(category_id) ON UPDATE CASCADE,
    picture_data TEXT CHECK (
        picture_data LIKE 'data:image/webp;base64,%'
        AND octet_length(picture_data) <= 13981039
    ),
    -- Headcount limit; NULL = no limit (see the capacity triggers under Joined events)
    max_participants INTEGER CHECK (max_participants IS NULL OR max_participants >= 2),
    CONSTRAINT chk_event_times CHECK (end_time IS NULL OR end_time >= start_time)
);

-- #region Event comments
CREATE TABLE event_comments(
    comment_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    comment_content TEXT NOT NULL CHECK (char_length(btrim(comment_content)) BETWEEN 1 AND 2000),
    comment_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    sender_uid TEXT NOT NULL REFERENCES users(uid) ON UPDATE CASCADE,
    -- NULL for main comments; replies only reference the main comment (see trigger below)
    replying_to TEXT,
    CONSTRAINT uc_comment_event UNIQUE (comment_id, event_id),
    -- Replies must be on the same event as their main comment, and are deleted with it
    CONSTRAINT fk_reply_parent FOREIGN KEY (replying_to, event_id)
        REFERENCES event_comments(comment_id, event_id) ON DELETE CASCADE,
    CONSTRAINT chk_not_self_reply CHECK (replying_to <> comment_id)
);

-- Reject replies to replies (keeps threads one level deep)
CREATE OR REPLACE FUNCTION check_reply_target() RETURNS trigger
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

CREATE OR REPLACE TRIGGER trg_check_reply_target BEFORE INSERT OR UPDATE ON event_comments
    FOR EACH ROW EXECUTE FUNCTION check_reply_target();

-- #region Joined events 
-- (create rows for each user)
CREATE TABLE joined_events(
    event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    joiner_uid TEXT NOT NULL REFERENCES users(uid) ON UPDATE CASCADE,
    CONSTRAINT uc_event_joiner UNIQUE (event_id, joiner_uid)
);

-- Reject joins once an event reaches max_participants. Locking the event row
-- makes two people who join at the same moment take turns, so they can't both
-- get the last spot. SECURITY DEFINER because joiners can't lock someone
-- else's event under RLS.
CREATE OR REPLACE FUNCTION public.check_event_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    max_count INTEGER;
BEGIN
    SELECT max_participants INTO max_count FROM public.events
    WHERE event_id = NEW.event_id FOR UPDATE;

    -- Already joined: let the unique constraint handle it (the app treats that as success)
    IF EXISTS (
        SELECT 1 FROM public.joined_events
        WHERE event_id = NEW.event_id AND joiner_uid = NEW.joiner_uid
    ) THEN
        RETURN NEW;
    END IF;

    IF max_count IS NOT NULL AND (
        SELECT count(*) FROM public.joined_events WHERE event_id = NEW.event_id
    ) >= max_count THEN
        RAISE EXCEPTION 'event_full' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_check_event_capacity BEFORE INSERT ON joined_events
    FOR EACH ROW EXECUTE FUNCTION public.check_event_capacity();

-- Reject lowering max_participants below the people who already joined.
CREATE OR REPLACE FUNCTION check_capacity_not_below_joined() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.max_participants IS NOT NULL AND (
        SELECT count(*) FROM joined_events WHERE event_id = NEW.event_id
    ) > NEW.max_participants THEN
        RAISE EXCEPTION 'capacity_below_joined' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_check_capacity_not_below_joined BEFORE UPDATE OF max_participants ON events
    FOR EACH ROW EXECUTE FUNCTION check_capacity_not_below_joined();

-- #region Chats list
-- (create rows for each user)
-- Two kinds of chat share this table and chat_msgs:
--   direct chat: two people, event_id NULL, chat_id a random UUID
--   event group chat: event_id set, chat_id 'event:' || event_id. Rows are
--   managed only by the group chat triggers below (RLS stops users from
--   adding, changing, or removing them).
CREATE TABLE chats_list(
    chat_id TEXT NOT NULL,
    -- The user's own label for the chat, just for their reference. NULL (the
    -- default) shows the other person's name, or the event title for group chats.
    chat_name TEXT CHECK (char_length(btrim(chat_name)) BETWEEN 1 AND 100),
    user_id TEXT NOT NULL REFERENCES users(uid) ON UPDATE CASCADE,
    event_id TEXT REFERENCES events(event_id) ON DELETE CASCADE,
    CONSTRAINT uc_chat_user UNIQUE (chat_id, user_id),
    CONSTRAINT chk_group_chat_id CHECK (event_id IS NULL OR chat_id = 'event:' || event_id)
);

-- #region Chat messages
CREATE TABLE chat_msgs(
    msg_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    chat_id TEXT NOT NULL, -- Foreign key not used since primary key not used in chats_list (by user instead of by chat)
    msg_content TEXT NOT NULL CHECK (char_length(btrim(msg_content)) BETWEEN 1 AND 2000),
    msg_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    sender_uid TEXT NOT NULL REFERENCES users(uid) ON UPDATE CASCADE
);

-- #region Event group chats
-- Every event has a group chat in chats_list / chat_msgs. These triggers keep
-- its members in step with the event: the organizer joins when the event is
-- posted, joiners are added and removed with joined_events, and deleting the
-- event deletes the chat. Rows start with no label (chat_name NULL), so the app
-- shows the event's current title. SECURITY DEFINER because users can't add or
-- remove group chat rows themselves (see RLS below).

CREATE OR REPLACE FUNCTION public.group_chat_add_organizer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.chats_list (chat_id, user_id, event_id)
    VALUES ('event:' || new.event_id, new.organizer_uid, new.event_id)
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    RETURN new;
END $$;
CREATE OR REPLACE TRIGGER trg_group_chat_add_organizer AFTER INSERT ON events
    FOR EACH ROW EXECUTE FUNCTION public.group_chat_add_organizer();

CREATE OR REPLACE FUNCTION public.group_chat_add_joiner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.chats_list (chat_id, user_id, event_id)
    SELECT 'event:' || e.event_id, new.joiner_uid, e.event_id
    FROM public.events e WHERE e.event_id = new.event_id
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    RETURN new;
END $$;
CREATE OR REPLACE TRIGGER trg_group_chat_add_joiner AFTER INSERT ON joined_events
    FOR EACH ROW EXECUTE FUNCTION public.group_chat_add_joiner();

-- The organizer stays in even if they leave their own event's join list.
CREATE OR REPLACE FUNCTION public.group_chat_remove_joiner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM public.chats_list c
    USING public.events e
    WHERE c.event_id = old.event_id AND c.user_id = old.joiner_uid
        AND e.event_id = old.event_id AND e.organizer_uid <> old.joiner_uid;
    RETURN old;
END $$;
CREATE OR REPLACE TRIGGER trg_group_chat_remove_joiner AFTER DELETE ON joined_events
    FOR EACH ROW EXECUTE FUNCTION public.group_chat_remove_joiner();

-- chats_list rows go with the event (ON DELETE CASCADE); chat_msgs has no
-- foreign key, so its messages are removed here.
CREATE OR REPLACE FUNCTION public.group_chat_delete_messages() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM public.chat_msgs WHERE chat_id = 'event:' || old.event_id;
    RETURN old;
END $$;
CREATE OR REPLACE TRIGGER trg_group_chat_delete_messages BEFORE DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION public.group_chat_delete_messages();

-- #region Notifications
-- Types:
--   event_joined   someone joined your event (to the organizer)
--   event_updated  an event you joined changed time or place (to joiners)
--   event_deleted  an event you joined was deleted (to joiners)
--   event_reminder an event you joined starts within the hour (to joiners)
CREATE TABLE notifications(
    notification_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recipient_uid TEXT NOT NULL REFERENCES users(uid) ON UPDATE CASCADE,
    -- Who did it; NULL for reminders
    actor_uid TEXT REFERENCES users(uid) ON UPDATE CASCADE,
    -- Set to NULL when the event is deleted, so event_deleted notices stay
    event_id TEXT REFERENCES events(event_id) ON DELETE SET NULL,
    -- Title when the notification was made (shown once the event is gone)
    event_title TEXT,
    notification_type TEXT NOT NULL CHECK (
        notification_type IN ('event_joined', 'event_updated', 'event_deleted', 'event_reminder')
    ),
    -- event_updated: the new values of what changed, e.g. {"location": "Snell 101"}
    -- or {"start_time": 1763830800, "end_time": null}
    details JSONB,
    create_time BIGINT NOT NULL DEFAULT extract(epoch FROM now())::bigint,
    is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_uid, create_time);
-- Leaving and rejoining an event doesn't notify the organizer again
CREATE UNIQUE INDEX uq_notification_joined ON notifications(recipient_uid, actor_uid, event_id)
    WHERE notification_type = 'event_joined';
-- One reminder per person per event
CREATE UNIQUE INDEX uq_notification_reminder ON notifications(recipient_uid, event_id)
    WHERE notification_type = 'event_reminder';

-- Tells the organizer when someone else joins their event.
-- SECURITY DEFINER because the joiner can't write to the organizer's inbox.
CREATE OR REPLACE FUNCTION public.notify_event_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_uid, actor_uid, event_id, event_title, notification_type)
  SELECT e.organizer_uid, new.joiner_uid, new.event_id, e.event_title, 'event_joined'
  FROM public.events e
  WHERE e.event_id = new.event_id AND e.organizer_uid <> new.joiner_uid
  ON CONFLICT (recipient_uid, actor_uid, event_id) WHERE notification_type = 'event_joined' DO NOTHING;
  RETURN new;
END;
$$;
CREATE OR REPLACE TRIGGER on_event_joined
  AFTER INSERT ON joined_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_joined();

-- Tells everyone who joined when the time or place changes. `details` holds
-- the new values of what changed. A new start time also clears old reminders
-- so a fresh one is made for the new time.
CREATE OR REPLACE FUNCTION public.notify_event_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
BEGIN
  IF new.start_time IS DISTINCT FROM old.start_time OR new.end_time IS DISTINCT FROM old.end_time THEN
    changes := changes || jsonb_build_object('start_time', new.start_time, 'end_time', new.end_time);
  END IF;
  IF new.location IS DISTINCT FROM old.location THEN
    changes := changes || jsonb_build_object('location', new.location);
  END IF;
  IF changes = '{}'::jsonb THEN
    RETURN new;
  END IF;

  IF new.start_time IS DISTINCT FROM old.start_time THEN
    DELETE FROM public.notifications
    WHERE event_id = new.event_id AND notification_type = 'event_reminder';
  END IF;

  INSERT INTO public.notifications (recipient_uid, actor_uid, event_id, event_title, notification_type, details)
  SELECT j.joiner_uid, new.organizer_uid, new.event_id, new.event_title, 'event_updated', changes
  FROM public.joined_events j
  WHERE j.event_id = new.event_id AND j.joiner_uid <> new.organizer_uid;
  RETURN new;
END;
$$;
CREATE OR REPLACE TRIGGER on_event_updated
  AFTER UPDATE OF start_time, end_time, location ON events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_updated();

-- Tells everyone who joined when an event is deleted. Runs BEFORE DELETE,
-- while joined_events still lists them. Older notifications about the event
-- are removed, since they'd link to a page that no longer exists.
CREATE OR REPLACE FUNCTION public.notify_event_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.notifications WHERE event_id = old.event_id;
  INSERT INTO public.notifications (recipient_uid, actor_uid, event_id, event_title, notification_type)
  SELECT j.joiner_uid, old.organizer_uid, old.event_id, old.event_title, 'event_deleted'
  FROM public.joined_events j
  WHERE j.event_id = old.event_id AND j.joiner_uid <> old.organizer_uid;
  RETURN old;
END;
$$;
CREATE OR REPLACE TRIGGER on_event_deleted
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_deleted();

-- Creates "starts within the hour" reminders for the calling user's joined
-- events. There's no server to run this on a schedule, so the app calls it
-- each time it checks notifications (listNotifications in src/api.jsx).
-- Each reminder is made once (uq_notification_reminder).
CREATE OR REPLACE FUNCTION public.create_due_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  me TEXT := (SELECT auth.uid())::text;
  now_s BIGINT := extract(epoch FROM now())::bigint;
BEGIN
  IF me IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (recipient_uid, event_id, event_title, notification_type)
  SELECT me, e.event_id, e.event_title, 'event_reminder'
  FROM public.joined_events j
  JOIN public.events e ON e.event_id = j.event_id
  WHERE j.joiner_uid = me AND e.start_time > now_s AND e.start_time <= now_s + 3600
  ON CONFLICT (recipient_uid, event_id) WHERE notification_type = 'event_reminder' DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_due_reminders() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_due_reminders() TO authenticated;

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
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

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
CREATE OR REPLACE FUNCTION is_chat_member(target_chat TEXT) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM chats_list
        WHERE chat_id = target_chat AND user_id = (SELECT auth.uid())::text
    );
$$;

CREATE POLICY chats_read ON chats_list FOR SELECT TO authenticated
    USING (is_chat_member(chat_id));
-- Direct chats only: add your own row first, then rows for the other
-- participant. Group chat rows (event_id set, or an 'event:' chat_id) come
-- only from the triggers, so nobody can add themselves to a group.
CREATE POLICY chats_insert ON chats_list FOR INSERT TO authenticated
    WITH CHECK (
        event_id IS NULL AND chat_id NOT LIKE 'event:%'
        AND (user_id = (SELECT auth.uid())::text OR is_chat_member(chat_id))
    );
-- Anyone can relabel their own row, direct or group. Only chat_name can change
-- (see the GRANT below), so nobody can move their row into another chat.
CREATE POLICY chats_update_own ON chats_list FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY chats_delete_own ON chats_list FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid())::text AND event_id IS NULL);

CREATE POLICY msgs_read ON chat_msgs FOR SELECT TO authenticated
    USING (is_chat_member(chat_id));
CREATE POLICY msgs_insert ON chat_msgs FOR INSERT TO authenticated
    WITH CHECK (sender_uid = (SELECT auth.uid())::text AND is_chat_member(chat_id));

-- Only the triggers and create_due_reminders() create notifications, so there's no insert policy
CREATE POLICY notifications_read_own ON notifications FOR SELECT TO authenticated
    USING (recipient_uid = (SELECT auth.uid())::text);
CREATE POLICY notifications_update_own ON notifications FOR UPDATE TO authenticated
    USING (recipient_uid = (SELECT auth.uid())::text)
    WITH CHECK (recipient_uid = (SELECT auth.uid())::text);

-- Users can only mark notifications as read, not change what they say
REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (is_read) ON notifications TO authenticated;
-- Chat rows: users only change their own label
REVOKE UPDATE ON chats_list FROM authenticated;
GRANT UPDATE (chat_name) ON chats_list TO authenticated;
