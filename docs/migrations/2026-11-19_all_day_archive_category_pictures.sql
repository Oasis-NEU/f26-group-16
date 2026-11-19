-- Migration: all-day events, event archiving, and category placeholder pictures.
-- Run once in the Supabase SQL editor on a database made from the previous
-- docs/main_schema.sql, then the -19b and -19c files. Safe to run twice. docs/main_schema.sql already
-- includes everything here for new databases.
--
-- After this, run docs/category_pictures.sql to fill in the pictures.

-- #region All-day events
-- All-day events start at local midnight of their first day and end at
-- 23:59:59 of their last day. The organizer's browser works those out, so the
-- database never needs to know a time zone.
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_all_day_end;
ALTER TABLE events ADD CONSTRAINT chk_all_day_end CHECK (NOT all_day OR end_time IS NOT NULL);

-- #region Archiving
-- When an event drops off the homepage and schedule suggestions: right after
-- the last day of an all-day event, otherwise 24 hours after it ends (events
-- without an end time count as an hour long). Archived events still open by
-- link, but can't be joined.
ALTER TABLE events ADD COLUMN IF NOT EXISTS archive_time BIGINT GENERATED ALWAYS AS (
    CASE WHEN all_day THEN end_time + 1
         ELSE COALESCE(end_time, start_time + 3600) + 86400 END
) STORED;
CREATE INDEX IF NOT EXISTS idx_events_archive_time ON events(archive_time);

-- Reject joins once an event is full (event_full) or archived (event_archived).
CREATE OR REPLACE FUNCTION public.check_event_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    max_count INTEGER;
    archived_at BIGINT;
BEGIN
    SELECT max_participants, archive_time INTO max_count, archived_at FROM public.events
    WHERE event_id = NEW.event_id FOR UPDATE;

    -- Already joined: let the unique constraint handle it (the app treats that as success)
    IF EXISTS (
        SELECT 1 FROM public.joined_events
        WHERE event_id = NEW.event_id AND joiner_uid = NEW.joiner_uid
    ) THEN
        RETURN NEW;
    END IF;

    -- Example data loaded from the SQL editor can still add joins to old events
    -- (Bug, kept as it was run: current_user is the owner inside SECURITY
    -- DEFINER, so this never fires. Fixed in 2026-11-19b; replaced in -19c.)
    IF archived_at <= extract(epoch FROM now())::bigint AND current_user IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'event_archived' USING ERRCODE = 'check_violation';
    END IF;

    IF max_count IS NOT NULL AND (
        SELECT count(*) FROM public.joined_events WHERE event_id = NEW.event_id
    ) >= max_count THEN
        RAISE EXCEPTION 'event_full' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- #region Notifications
-- event_updated also fires when an event switches to or from all day, and
-- `details` carries `all_day` with the new times.
CREATE OR REPLACE FUNCTION public.notify_event_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
BEGIN
  IF new.start_time IS DISTINCT FROM old.start_time OR new.end_time IS DISTINCT FROM old.end_time
     OR new.all_day IS DISTINCT FROM old.all_day THEN
    changes := changes || jsonb_build_object('start_time', new.start_time, 'end_time', new.end_time, 'all_day', new.all_day);
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
  AFTER UPDATE OF start_time, end_time, all_day, location ON events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_updated();

-- All-day events get no "starts within the hour" reminder: it would arrive
-- around 11 PM the night before.
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
  WHERE j.joiner_uid = me AND NOT e.all_day AND e.start_time > now_s AND e.start_time <= now_s + 3600
  ON CONFLICT (recipient_uid, event_id) WHERE notification_type = 'event_reminder' DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_due_reminders() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_due_reminders() TO authenticated;

-- #region Category pictures
-- Default cover picture for events in the category that have none of their
-- own. Filled in by docs/category_pictures.sql (only admins can write
-- event_categories).
ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS picture_data TEXT CHECK (
    picture_data LIKE 'data:image/webp;base64,%'
    AND octet_length(picture_data) <= 13981039
);
