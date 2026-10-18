# Project Outline

## Overview

An online platform where users can publish events for everyone to see and reply to. It can be used for hosting local sport events (e.g. a school tennis tournament), but can function as a general public calendar platform.

Each post includes a picture, title, description, and the start/end date of the event. Others can comment on the post or reach out to the organizer directly (e.g. in-platform direct message, contact info).

## Interface Functions

### Homepage

- The home page lists the available events in a grid view, detailing the picture, title, date, and organizer of the event
- The user can choose different categories (e.g. sport, entertainment) to filter events
- Additional filters like date range

### Detail Page

- Each post includes a picture, title, description, and the start/end date of the event
- "Join event" button with a display of how many people already joined
- Comments with replies
- "Direct message" button
- Notification API Link (if possible)
    - Or keep notifications in a list viewable on the homepage

## Database Schema

- Table of users
    - Name, hashed password, UID
- Table for events created
    - Title, picture, start & end date, organizer UID, unique event ID
- Table for "joined events" information
    - Event ID and UID for each user joined
- Tables for direct messages
    - Create individual tables for each chat (message content, date, sender) labeled with unique ID
        - Fetch chat list: Query chats based on UID → Query participant UIDs based on chat ID
    - Use another table for lists of chats (chat ID, UID); separate entries for each user

### SQL Representation

```sql
-- Table of users
CREATE TABLE users(
    uid TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    pwd_hash TEXT NOT NULL
);

-- Table of events created
CREATE TABLE events(
    event_id TEXT NOT NULL,
    create_date DATE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    organizer_uid TEXT NOT NULL,
    picture_url TEXT,
    FOREIGN KEY (organizer_uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- Joined events information by user
CREATE TABLE joined_events(
    event_id TEXT NOT NULL,
    joiner_uid TEXT NOT NULL,
    FOREIGN KEY (joiner_uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- Chats list information by user
CREATE TABLE chats_list(
    chat_id TEXT NOT NULL,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL
);

-- [Create for each chat]
CREATE TABLE chat_<Chat ID>(
    msg_content TEXT NOT NULL,
    date DATE NOT NULL,
    sender_uid TEXT,
    FOREIGN KEY (sender_uid) REFERENCES users(uid) ON DELETE SET NULL
);
```

### Commands for Fetching Records

```sql
-- Fetch list of events
SELECT * FROM events ORDER BY start_date DESC;

-- Fetch number of event joiners for an event
SELECT COUNT(joiner_uid) FROM joined_events WHERE event_id=<id>;

-- Fetch events that the user has joined
SELECT event_id FROM joined_events WHERE joiner_uid=<id>;

-- Fetch list of chats for a user
SELECT chat_id FROM chats_list WHERE user_id=<id>;

-- For each chat:
SELECT user_id FROM chats_list WHERE chat_id=<id>;

-- Fetch message list
SELECT * FROM chat_<Chat ID>;
```
