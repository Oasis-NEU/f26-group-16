# Project Outline

## Overview

An online platform where users can publish events for everyone to see and reply to. It can be used for hosting local sport events (e.g. a school tennis tournament), but can function as a general public calendar platform.

Each post includes a picture, title, description, and the start/end date of the event. Others can comment on the post or reach out to the organizer directly (e.g. in-platform direct message, contact info).

## Interface Functions

### Homepage

- The home page lists the available events in a grid view, detailing the picture, title, date, and organizer of the event
- The user can choose different categories (e.g. sport, entertainment) to filter events
    - Additional filters like date range
- The user can search for events based on title or description

### Detail page

- Each post includes a picture, title, description, and the start/end date of the event
- "Join event" button with a display of how many people already joined/subscribed
- Comments with replies
- "Direct message" button to contact the organizer

### Personal schedule page

- Shows all events the user has joined in a list, organized by the date of the event
- Each entry shows the event picture, title, and start/end times, and jumps to the detail page when clicked
- The user can remove the event from the join list from this page

### Direct messages page

- List of messages displayed in a popup on homepage, displaying the chat name and most recent message for each entry
- Each chat supports simple text messages, attempt to fetch latest messages every 2 seconds in the page

## Database Schema

- Table of users
    - Name, hashed password, UID
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
    pwd_hash TEXT NOT NULL
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
