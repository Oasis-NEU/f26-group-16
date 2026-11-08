-- Adds the notification inbox to an existing database, keeping all current data.
-- Safe to run once on the live project. Fresh databases get this from main_schema.sql.

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
