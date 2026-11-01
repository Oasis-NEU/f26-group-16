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
| `logOut()` | Logs out (for the account settings popup) |
| `onSessionChange(callback)` | Lets `App.jsx` switch between the login page and the app |
| `getProfile(authId)` | The `users` row for the logged-in account (`uid` = `authId`) |

If `is_active` is false, `App.jsx` logs the user straight back out and shows "This account has been deleted."

## Troubleshooting

- **"Database error saving new user"**: the trigger failed. Check that step 2 ran, and that `users` has no other `NOT NULL` column the trigger doesn't fill.
- **Sign-up says "Check your inbox" but no email arrives**: Confirm email is still on (step 1).
- **"Email address … is invalid"**: Supabase rejects domains that can't receive mail (e.g. `test.local`). Use a real address.
- **"Your account isn't set up yet"**: the account was created before the trigger existed, so it has no `users` row. Delete it in Authentication → Users and sign up again.
