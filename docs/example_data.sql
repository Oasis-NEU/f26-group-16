DO $$
DECLARE
    example_user TEXT := (SELECT id FROM auth.users WHERE email = 'user@example.com' LIMIT 1);
BEGIN
IF example_user IS NULL THEN
    RAISE EXCEPTION 'No user with email "user@example.com"';
END IF;
-- Example user
INSERT INTO users(uid, full_name, is_active) 
VALUES (example_user, 'Example user 1', true);

-- Example events without picture data
INSERT INTO events (event_id, event_title, event_description, create_time, start_time, end_time, location, organizer_uid, category_id, picture_data) VALUES
('0248f7db-1499-4d66-bc7e-ba4b3cf31a98', 'Welcome Back Picnic', 'Free food, lawn games, and club tables. (This one already happened; it shows up when you widen the date filter.)', 1793567704, 1792684800, 1792695600, 'Main Quad', example_user, 'social', null),
('06c83de2-018b-468f-9e3a-83a00d23252b', 'Board Game Night', 'Catan, Codenames, Ticket to Ride, and whatever you bring. Pizza at 8.', 1793567703, 1793923200, 1793934000, 'West Hall Common Room', example_user, 'social', null),
('3404fd35-cf9b-41b9-afaa-f24b77b5b4db', 'Photography Club Photo Walk', 'A slow loop around campus looking for fall colors. Phones are totally fine, no fancy camera needed.', 1793567703, 1794150000, null, 'Meet at the Main Quad fountain', example_user, 'clubs', null),
('37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Sunset Doubles Tennis Social', 'Rotating doubles until the lights come on. Beginners welcome; we’ll pair you up with someone who has played before.

We have a few spare rackets and plenty of balls.', 1793567703, 1793831400, 1793838600, 'Campus Tennis Courts', example_user, 'sports', null),
('6ecdaa52-0128-45d4-91fd-b97604ca8d43', 'Open Mic Night', 'Music, poetry, comedy, anything goes. Five-minute slots; sign up at the door or just come to watch.', 1793567703, 1794096000, 1794105000, 'Student Center Lounge', example_user, 'arts', null),
('c562e04a-1593-4a10-a3e8-346448a7a56c', '24-Hour Hack Night', 'Build anything in 24 hours with a team of up to four. Workshops for first-timers on Saturday morning, demos and prizes at the end.', 1793567703, 1794610800, 1794697200, 'Engineering Building, Room 110', example_user, 'clubs', null),
('c7a5b9a8-770a-42a8-b46d-8b0d87203457', 'Career Fair Prep Workshop', 'Get your resume reviewed, practice a 30-second intro, and learn what recruiters actually ask at the fair.', 1793567703, 1794333600, 1794339000, 'Career Center, Room 204', example_user, 'career', null),
('d2e09c66-9bf7-4e21-a64a-16fcb997e780', 'Pickup Soccer on North Field', 'Casual 7v7, all skill levels. We split teams when we get there. Bring water and a light and a dark shirt.', 1793567702, 1793653200, 1793658600, 'North Field', example_user, 'sports', null),
('d3889db1-ef71-44cf-b671-9d3b5684620a', 'Midterm Study Jam: Calc & Stats', 'Quiet-ish group studying with a couple of TAs floating around for questions.

We’ll do practice problems on the whiteboards at 7 and 8. Snacks provided!', 1793567702, 1793746800, 1793757600, 'Main Library, 2nd floor group study area', example_user, 'academic', null);

-- Example comments
INSERT INTO event_comments (comment_id, event_id, comment_content, comment_time, sender_uid, replying_to) VALUES
('030995d9-9fed-4f8b-80b6-fbc460379456', 'd3889db1-ef71-44cf-b671-9d3b5684620a', 'Will there be anyone who can help with hypothesis testing?', 1793567702, example_user, null),
 ('47374247-1115-4f9f-b4a7-0ce60465815b', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Yes, the lot behind the gym is free after 5.', 1793567963, example_user, '9d76606f-06c3-4bda-b320-f06cf7c8f9b8'),
 ('5bebe448-33f8-46a7-a562-61146d9f0445', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Do I need my own racket?', 1793567703, example_user, null),
 ('9d76606f-06c3-4bda-b320-f06cf7c8f9b8', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Count me in! Is there parking nearby?', 1793567963, example_user, null),
 ('b8b702cb-2f2e-45ac-a5b3-29c57468d83f', '37c02568-92e6-4f2f-a3be-9d71f17dd390', 'Nope, we have spares. Just bring sneakers.', 1793567704, example_user, '5bebe448-33f8-46a7-a562-61146d9f0445'),
 ('d471cd53-0406-4fa6-808d-3386c1d6a353', 'd3889db1-ef71-44cf-b671-9d3b5684620a', 'Yes! One of the TAs covers intro stats.', 1793567703, example_user, '030995d9-9fed-4f8b-80b6-fbc460379456');

-- Example joined events
INSERT INTO joined_events (event_id, joiner_uid) VALUES
('6ecdaa52-0128-45d4-91fd-b97604ca8d43', example_user),
('d3889db1-ef71-44cf-b671-9d3b5684620a', example_user);

END $$;