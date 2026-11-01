---
name: rally-feature
description: Build or change a Rally page, component, or Supabase data function the way Group 16 does it. Use when adding a page in src/pages, a component in src/components, a read/write function in src/api.jsx, or when wrapping up any change to the app.
---

# Building a Rally feature

`AGENTS.md` has the product spec, the database schema, and the design tokens. This skill is the workflow for using them. Read the `AGENTS.md` section for the page you're building before writing code.

## 1. Before you start

- Never work on `main`. Branch first: `git switch -c <your-name>/<feature>`.
- Check the Slack canvas "Component arrangements" in #f26-group16 so two people don't build the same page.
- Find the tables your page reads and writes in `AGENTS.md` → Database Schema.

## 2. Data: go through `src/api.jsx`

- Pages and components never import `supabase` directly. They call functions from `src/api.jsx`.
- If the function you need doesn't exist, add it there. Follow the existing pattern:
  - Validate input first with `check()`, then run one query and `unwrap()` the result.
  - Throw an `Error` with a short, user-readable message. Callers use `try/catch` and show `error.message`.
  - Select users with `USER_COLUMNS`, events with `EVENT_COLUMNS` (adds `organizer` and `category`), and comments with `COMMENT_COLUMNS` (adds `sender`), so every page gets the same shape.
- Validation rules (enforce in `api.jsx`, not only in the form). They mirror the CHECK constraints in `AGENTS.md`, so change both together:
  - Event title is required and at most 100 characters; description ≤ 5000; location ≤ 200; comments 1–2000.
  - End time is optional, but if set, `end_time >= start_time`.
  - Pictures are stored as `data:image/webp;base64,...`, at most 10MB. Always convert uploads with `fileToDataUrl(file)`: it resizes to fit 1920x1080 and encodes WebP with `@jsquash/webp` (Safari's canvas can't).
  - Replies only point at a main comment (`replying_to` of a reply is the main comment's id).
- Times are UNIX timestamps **in seconds**. Use the helpers in `src/utils/format.js` (`formatEventTime`, `toDateTimeInput`/`fromDateTimeInput`, `startOfDay`/`endOfDay`) instead of converting by hand.
- The Supabase project is shared and live. **Don't create, alter, or drop tables** without posting the change in #f26-group16 first. The schema in `AGENTS.md` is the source of truth.

## 3. Keys and secrets

- The browser may only see `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, both in `.env` (git-ignored).
- Anything prefixed `VITE_` ends up in the public JS bundle. AI API keys and the Supabase secret key must never be in a `VITE_` variable or anywhere under `src/`.
- `SUPABASE_SECRET_KEY` in `.env` bypasses RLS. Use it only from your own machine to inspect or clean up the test database, never in app code.
- Never commit `.env`, and never paste keys into Slack, issues, or PRs.

## 4. UI: pages and components

- One page per file in `src/pages/`, default-exporting a function component. Move UI into `src/components/` once two pages use it.
- Adding a page: add its path builder to `src/utils/routes.js` (`parseRoute` too), then its case in `currentPage()` in `App.jsx`. Link with the builders (`eventPath(id)`, `profilePath(uid)`, ...), never hand-written hashes. Pages get the logged-in `profile` row as a prop.
- Reuse what exists:
  - `src/components/ui.jsx`: `primaryButton`, `secondaryButton`, `smallButton`, `inputClass`, `ErrorMessage`, `Notice` (empty/not-found states).
  - `EventCard` for event grids (pass edit/delete buttons as `children`), `EventPicture` for a picture or the category glyph.
  - `displayName(user)` from `src/utils/format.js` wherever a name is shown, so deleted accounts read "Deleted account".
- Colors come only from the theme tokens (`bg-page`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `brand-*`, `danger`). No `gray-*`, `slate-*`, `bg-white`, or hex values.
- Reuse the button, card, and corner styles in `AGENTS.md` → Layout and components instead of inventing new ones.
- Handle three states on every data-driven screen: loading, empty, and error.
- Copy is short, casual, and written for college students. No fake comment counts, user counts, or testimonials.
- Accessibility: `aria-label` on icon-only buttons and unlabeled inputs, `aria-hidden="true"` on decorative SVGs, no motion under `prefers-reduced-motion: reduce`.

## 5. Before you open a PR

1. `npm run build` passes.
2. `npm run lint` has no new warnings.
3. No hard-coded neutral colors:
   ```bash
   grep -rnE '(text|bg|border|ring|from|to)-(slate|gray)-[0-9]|bg-white' src
   ```
4. Log in as the test user (`user@example.com` / `password`) and check the page in light and dark mode, at desktop width and at 375px with no horizontal scroll. If the database is empty, run `node --env-file=.env scripts/seed_events.mjs` first.
5. `git status` shows no `.env` and no stray files.
6. PR description says what changed, which tables it touches, and how you tested it.
