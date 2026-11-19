-- Migration: stop joins once an event ends, not 24 hours later when it's
-- archived. Run once in the Supabase SQL editor after the -19 and -19b files.
-- Safe to run twice.
--
-- Archiving (events.archive_time) only takes events off the homepage and
-- schedule suggestions; joining an event that's already over made no sense.
-- The error is now 'event_ended' (the app also understands the old
-- 'event_archived').
CREATE OR REPLACE FUNCTION public.check_event_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    max_count INTEGER;
    ends_at BIGINT;
BEGIN
    -- Events without an end time count as an hour long
    SELECT max_participants, COALESCE(end_time, start_time + 3600) INTO max_count, ends_at
    FROM public.events
    WHERE event_id = NEW.event_id FOR UPDATE;

    -- Already joined: let the unique constraint handle it (the app treats that as success)
    IF EXISTS (
        SELECT 1 FROM public.joined_events
        WHERE event_id = NEW.event_id AND joiner_uid = NEW.joiner_uid
    ) THEN
        RETURN NEW;
    END IF;

    -- Only app requests (a logged-in user) are checked, so example data loaded
    -- from the SQL editor can still add joins to old events. current_user
    -- can't tell them apart: it's this function's owner (SECURITY DEFINER).
    IF ends_at <= extract(epoch FROM now())::bigint AND (SELECT auth.uid()) IS NOT NULL THEN
        RAISE EXCEPTION 'event_ended' USING ERRCODE = 'check_violation';
    END IF;

    IF max_count IS NOT NULL AND (
        SELECT count(*) FROM public.joined_events WHERE event_id = NEW.event_id
    ) >= max_count THEN
        RAISE EXCEPTION 'event_full' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
