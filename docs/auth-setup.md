# Auth setup (Supabase Auth)

Login and sign-up use Supabase Auth. Users sign up with their email and a password, and Supabase stores and checks the passwords, so our `users` table never holds them.

This follows the users table in `AGENTS.md`: `users.uid` is the Supabase Auth user id, so the RLS rules there (`uid = auth.uid()::text`, `organizer_uid = auth.uid()::text`, and so on) work as written.

The one addition is a database trigger that creates the `users` row when someone signs up. Doing it in the database means an account can't end up half-created (signed up in Supabase Auth but missing from `users`).

## 1. Dashboard setting

Authentication → Sign In / Providers → **Email**:

- Email provider: **on**
- Confirm email: **off for now**. Supabase's built-in email service only delivers to members of the Supabase project and sends just a few emails per hour, so classmates would never get the link. Turn it back on once we set up our own email sender (Authentication → Emails → SMTP Settings). The app already handles both: with it on, sign-up shows "Check your inbox".

## 2. SQL (run once in the SQL Editor)

```sql
-- Create the `users` row automatically when someone signs up.
-- uid is the Supabase Auth user id; full_name comes from the sign-up form.
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

The RLS policies for `users` (`users_read`, `users_insert_own`, `users_update_own`) are in `AGENTS.md` → Row-level security.

## Fixing the first version (only if you ran the 11/1 SQL)

The first version of this file stored a random 10-digit number in `uid` and linked accounts through an extra `auth_id` column. That doesn't match the RLS rules in `AGENTS.md`, so undo it:

1. Authentication → Users: delete the test accounts made with the first version.
2. Run the SQL in step 2 above (it replaces the trigger function).
3. Then run this:

```sql
-- Remove leftover rows that used a 10-digit uid (real uids are Supabase UUIDs).
DELETE FROM users WHERE uid ~ '^[0-9]{10}$';

-- Remove the first version's policies and the auth_id column.
DROP POLICY IF EXISTS "Logged-in users can read profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
ALTER TABLE users DROP COLUMN IF EXISTS auth_id;

-- Same users policies as AGENTS.md.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_read ON users;
DROP POLICY IF EXISTS users_insert_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_read ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY users_insert_own ON users FOR INSERT TO authenticated
    WITH CHECK (uid = (SELECT auth.uid())::text);
CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
    USING (uid = (SELECT auth.uid())::text) WITH CHECK (uid = (SELECT auth.uid())::text);
```

## How the app uses it

All in `src/api.jsx`:

| Function | What it does |
|---|---|
| `signUp({ email, fullName, password, confirmPassword })` | Validates, then creates the account. The trigger above creates the `users` row. |
| `logIn(email, password)` | Logs in. The session is saved in the browser until logout. |
| `logOut()` | Logs out (menu bar and account settings page) |
| `onSessionChange(callback)` | Lets `App.jsx` switch between the login page and the app |
| `getProfile(authId)` | The `users` row for the logged-in account (`uid` = `authId`) |
| `updateProfile(uid, { fullName, pictureData })` | Changes the name and/or picture and returns the updated row |
| `changePassword({ currentPassword, newPassword, confirmPassword })` | Checks the current password by logging in again, then sets the new one |
| `deleteAccount(uid, password)` | Checks the password, sets `is_active` to false (the trigger below removes the login), and clears the session |

If `is_active` is false, `App.jsx` logs the user straight back out and shows "This account has been deleted."

## Account deletion (run once in the SQL Editor)

Deleting an account in the app sets `users.is_active` to false. This trigger then deletes the Supabase Auth login, so the same email can sign up again. The `users` row stays, so the account's comments and messages show as "Deleted account".

The `ALTER TABLE` lines add `ON UPDATE CASCADE` to every foreign key on `users.uid` (and `event_categories.category_id`), matching `docs/main_schema.sql`. Skip them if your database already has it. Fresh databases get all of this from `main_schema.sql`.

```sql
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    DELETE FROM auth.users WHERE id::text = OLD.uid;
    RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER trg_delete_auth_user_on_deactivate AFTER UPDATE OF is_active ON public.users
    FOR EACH ROW WHEN (OLD.is_active AND NOT NEW.is_active)
    EXECUTE FUNCTION public.delete_auth_user_on_deactivate();

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_organizer_uid_fkey,
    ADD CONSTRAINT events_organizer_uid_fkey FOREIGN KEY (organizer_uid) REFERENCES users(uid) ON UPDATE CASCADE;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_id_fkey,
    ADD CONSTRAINT events_category_id_fkey FOREIGN KEY (category_id) REFERENCES event_categories(category_id) ON UPDATE CASCADE;
ALTER TABLE event_comments DROP CONSTRAINT IF EXISTS event_comments_sender_uid_fkey,
    ADD CONSTRAINT event_comments_sender_uid_fkey FOREIGN KEY (sender_uid) REFERENCES users(uid) ON UPDATE CASCADE;
ALTER TABLE joined_events DROP CONSTRAINT IF EXISTS joined_events_joiner_uid_fkey,
    ADD CONSTRAINT joined_events_joiner_uid_fkey FOREIGN KEY (joiner_uid) REFERENCES users(uid) ON UPDATE CASCADE;
ALTER TABLE chats_list DROP CONSTRAINT IF EXISTS chats_list_user_id_fkey,
    ADD CONSTRAINT chats_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON UPDATE CASCADE;
ALTER TABLE chat_msgs DROP CONSTRAINT IF EXISTS chat_msgs_sender_uid_fkey,
    ADD CONSTRAINT chat_msgs_sender_uid_fkey FOREIGN KEY (sender_uid) REFERENCES users(uid) ON UPDATE CASCADE;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_uid_fkey,
    ADD CONSTRAINT notifications_recipient_uid_fkey FOREIGN KEY (recipient_uid) REFERENCES users(uid) ON UPDATE CASCADE;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_actor_uid_fkey,
    ADD CONSTRAINT notifications_actor_uid_fkey FOREIGN KEY (actor_uid) REFERENCES users(uid) ON UPDATE CASCADE;
```

### Restoring a deleted account

Setting `is_active` back to true isn't enough, because the login is gone. Instead:

1. The person signs up again with their email. That creates a new login and a new, empty `users` row.
2. Copy the new uid from Authentication → Users, then in the SQL Editor:

```sql
DELETE FROM users WHERE uid = '<new uid>';
UPDATE users SET uid = '<new uid>', is_active = true WHERE uid = '<old uid>';
```

`ON UPDATE CASCADE` moves their events, comments, joins, chats, and notifications to the new uid. The `DELETE` fails if they already posted, commented, joined, or messaged with the new account. Move or delete those rows first.

## Troubleshooting

- **"Database error saving new user"**: the trigger failed. Check that step 2 ran, and that `users` has no other `NOT NULL` column the trigger doesn't fill.
- **Sign-up says "Check your inbox" but no email arrives**: Confirm email is still on (step 1).
- **"Email address … is invalid"**: Supabase rejects domains that can't receive mail (e.g. `test.local`). Use a real address.
- **Deleting an account works, but the email still says "already has an account"**: the account deletion trigger above hasn't been run.
- **"Your account isn't set up yet"**: the account was created before the trigger existed, so it has no `users` row. Delete it in Authentication → Users and sign up again.
