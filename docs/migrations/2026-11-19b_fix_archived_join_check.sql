-- Migration: fix the archived-event join check from
-- 2026-11-19_all_day_archive_category_pictures.sql. Run once in the Supabase
-- SQL editor after that file. Safe to run twice.
--
-- check_event_capacity() is SECURITY DEFINER, so inside it current_user is the
-- function's owner, never 'authenticated', and the check let every join
-- through. App requests are now told apart by having a logged-in user
-- (auth.uid()); the SQL editor and secret key have none, so example data can
-- still add joins to old events.
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

    -- current_user is this function's owner here (SECURITY DEFINER), so app
    -- requests are recognized by their logged-in user instead
    IF archived_at <= extract(epoch FROM now())::bigint AND (SELECT auth.uid()) IS NOT NULL THEN
        RAISE EXCEPTION 'event_archived' USING ERRCODE = 'check_violation';
    END IF;

    IF max_count IS NOT NULL AND (
        SELECT count(*) FROM public.joined_events WHERE event_id = NEW.event_id
    ) >= max_count THEN
        RAISE EXCEPTION 'event_full' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
