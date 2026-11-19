DO $$
DECLARE
    example_user TEXT := (SELECT id FROM auth.users WHERE email = 'user@example.com' LIMIT 1);
    example_user_2 TEXT := (SELECT id FROM auth.users WHERE email = 'user2@example.com' LIMIT 1);
BEGIN
IF example_user IS NULL THEN
    RAISE EXCEPTION 'No user with email "user@example.com"'; END IF;
IF example_user_2 IS NULL THEN
    RAISE EXCEPTION 'No user with email "user2@example.com"'; END IF;
-- Example users
INSERT INTO users(uid, full_name, is_active) VALUES
(example_user, 'Example user 1', true),
(example_user_2, 'Example user 2', true);

-- Example events without picture data
INSERT INTO events (event_id, event_title, event_description, create_time, start_time, end_time, location, organizer_uid, category_id, max_participants) VALUES
('0248f7db-1499-4d66-bc7e-ba4b3cf31a98', 'Welcome Back Picnic', 'Free food, lawn games, and club tables. (This one already happened, so it’s archived: it’s off the homepage but still opens by link and on the organizer’s profile.)', 1796159704, 1795276800, 1795287600, 'Main Quad', example_user, 'social', 3),
('06c83de2-018b-468f-9e3a-83a00d23252b', 'Board Game Night', 'Catan, Codenames, Ticket to Ride, and whatever you bring. Pizza at 8.', 1796159703, 1796515200, 1796526000, 'West Hall Common Room', example_user, 'social', null),
('3404fd35-cf9b-41b9-afaa-f24b77b5b4db', 'Photography Club Photo Walk', 'A slow loop around campus looking for fall colors. Phones are totally fine, no fancy camera needed.', 1796159703, 1796742000, null, 'Meet at the Main Quad fountain', example_user, 'clubs', 8),
('37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Open Gym Volleyball', 'Rotating 6v6 games until the gym closes. Beginners welcome; we’ll pair you up with someone who has played before.

We have spare balls and a few sets of knee pads.', 1796159703, 1796423400, 1796430600, 'Marino Recreation Center, upper gym', example_user, 'sports', null),
('6ecdaa52-0128-45d4-91fd-b97604ca8d43', 'Open Mic Night', 'Music, poetry, comedy, anything goes. Five-minute slots; sign up at the door or just come to watch.', 1796159703, 1796688000, 1796697000, 'Student Center Lounge', example_user, 'arts', 25),
('c562e04a-1593-4a10-a3e8-346448a7a56c', '24-Hour Hack Night', 'Build anything in 24 hours with a team of up to four. Workshops for first-timers on Saturday morning, demos and prizes at the end.', 1796159703, 1797202800, 1797289200, 'Engineering Building, Room 110', example_user, 'clubs', 20),
('c7a5b9a8-770a-42a8-b46d-8b0d87203457', 'Career Fair Prep Workshop', 'Get your resume reviewed, practice a 30-second intro, and learn what recruiters actually ask at the fair.', 1796159703, 1796925600, 1796931000, 'Career Center, Room 204', example_user, 'career', null),
('d2e09c66-9bf7-4e21-a64a-16fcb997e780', 'Pickup Soccer on North Field', 'Casual 7v7, all skill levels. We split teams when we get there. Bring water and a light and a dark shirt.', 1796159702, 1796245200, 1796250600, 'North Field', example_user, 'sports', null),
('d3889db1-ef71-44cf-b671-9d3b5684620a', 'Midterm Study Jam: Calc & Stats', 'Quiet-ish group studying with a couple of TAs floating around for questions.

We’ll do practice problems on the whiteboards at 7 and 8. Snacks provided!', 1796159702, 1796338800, 1796349600, 'Main Library, 2nd floor group study area', example_user, 'academic', null);

-- Example comments
INSERT INTO event_comments (comment_id, event_id, comment_content, comment_time, sender_uid, replying_to) VALUES
('030995d9-9fed-4f8b-80b6-fbc460379456', 'd3889db1-ef71-44cf-b671-9d3b5684620a', 'Will there be anyone who can help with hypothesis testing?', 1796159702, example_user_2, null),
 ('47374247-1115-4f9f-b4a7-0ce60465815b', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Yes, the lot behind the gym is free after 5.', 1796159963, example_user, '9d76606f-06c3-4bda-b320-f06cf7c8f9b8'),
 ('5bebe448-33f8-46a7-a562-61146d9f0445', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Do I need my own ball?', 1796159703, example_user_2, null),
 ('9d76606f-06c3-4bda-b320-f06cf7c8f9b8', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Count me in! Is there parking nearby?', 1796159963, example_user_2, null),
 ('b8b702cb-2f2e-45ac-a5b3-29c57468d83f', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Nope, we have spares. Just bring sneakers.', 1796159704, example_user, '5bebe448-33f8-46a7-a562-61146d9f0445'),
 ('d471cd53-0406-4fa6-808d-3386c1d6a353', 'd3889db1-ef71-44cf-b671-9d3b5684620a', 'Yes! One of the TAs covers intro stats.', 1796159703, example_user, '030995d9-9fed-4f8b-80b6-fbc460379456');

-- Example joined events
INSERT INTO joined_events (event_id, joiner_uid) VALUES
('6ecdaa52-0128-45d4-91fd-b97604ca8d43', example_user_2),
('d3889db1-ef71-44cf-b671-9d3b5684620a', example_user_2),
('0248f7db-1499-4d66-bc7e-ba4b3cf31a98', example_user_2);

-- Example chats
INSERT INTO chats_list (chat_id, chat_name, user_id) VALUES
('0a4c01b0-07af-4b44-8180-83ebe5bac2e1', null, example_user),
('0a4c01b0-07af-4b44-8180-83ebe5bac2e1', 'My best organizer', example_user_2);
INSERT INTO chat_msgs (msg_id, chat_id, msg_content, msg_time, sender_uid) VALUES
  -- Direct message
('c72676da-d464-465f-9ea6-c2eca20b865b', '0a4c01b0-07af-4b44-8180-83ebe5bac2e1', 'Are there any available spots left?', 1794870803, example_user_2),
('5810d4bf-2ac7-43dc-972c-af8098e26a18', '0a4c01b0-07af-4b44-8180-83ebe5bac2e1', 'Yes, feel free to join!', 1794870900, example_user),
('095b9300-c5d1-4ee1-a1c1-0ae8e1b310c9', '0a4c01b0-07af-4b44-8180-83ebe5bac2e1', 'Sure, I will go ahead and join!', 1794870972, example_user_2),
  -- Event: Midterm Study Jam: Calc & Stats
('4289d9f3-8c76-4864-a613-1c0db8a03d18', 'event:d3889db1-ef71-44cf-b671-9d3b5684620a', 'I''m in!', 1794871100, example_user_2),
('788031a0-1d86-4b44-b9ba-f3a232b8b3f0', 'event:d3889db1-ef71-44cf-b671-9d3b5684620a', 'Welcome to the study group!', 1794871130, example_user),
('70f6ef89-bd33-440a-aec6-3697fb67134a', 'event:d3889db1-ef71-44cf-b671-9d3b5684620a', 'Let''s study!', 1794871200, example_user_2),
  -- Event: Welcome Back Picnic
('1669f46f-1775-4d6e-8221-94c392b03490', 'event:0248f7db-1499-4d66-bc7e-ba4b3cf31a98', 'I''m in!', 1794871100, example_user_2),
('fdc8b3b8-cf5d-48f0-91ed-cd7476ba0bf0', 'event:0248f7db-1499-4d66-bc7e-ba4b3cf31a98', 'Welcome to the picnic!', 1794871130, example_user),
('e89e8fdc-4d99-4644-bde2-68fb35f18095', 'event:0248f7db-1499-4d66-bc7e-ba4b3cf31a98', 'Let''s do this!', 1794871200, example_user_2);

IF to_regclass('public._example_images') IS NOT NULL THEN
    -- Insert image data for events
    UPDATE events AS target
    SET picture_data = source.image_data
    FROM _example_images AS source
    WHERE target.event_id = source.item_id;
    -- Insert profile picture
    UPDATE users as target
    SET profile_pic_data = source.image_data
    FROM _example_images AS source
    WHERE target.uid = example_user AND source.item_id = 'user@example.com'
    OR target.uid = example_user_2 AND source.item_id = 'user2@example.com';
END IF;
END $$;