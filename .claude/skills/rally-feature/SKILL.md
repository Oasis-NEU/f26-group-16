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
  - Never select `pwd_hash`. Use `USER_COLUMNS` when reading users.
- Validation rules (enforce in `api.jsx`, not only in the form):
  - Event title is required and at most 100 characters.
  - `end_time >= start_time`.
  - Pictures are images of at most 10MB, stored as `data:image/...;base64,...`. Use `fileToDataUrl()`.
- Times are UNIX timestamps **in seconds**. Convert with `Math.floor(date.getTime() / 1000)` going in and `new Date(seconds * 1000)` coming out.
- The Supabase project is shared and live. **Don't create, alter, or drop tables** without posting the change in #f26-group16 first.

## 3. Keys and secrets

- The browser may only see `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, both in `.env` (git-ignored).
- Anything prefixed `VITE_` ends up in the public JS bundle. AI API keys and the Supabase service-role key must live in a backend function, never in a `VITE_` variable.
- Never commit `.env`, and never paste keys into Slack, issues, or PRs.

## 4. UI: pages and components

- One page per file in `src/pages/`, default-exporting a function component. Move UI into `src/components/` once two pages use it.
- Colors come only from the theme tokens (`bg-page`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `brand-*`). No `gray-*`, `slate-*`, `bg-white`, or hex values.
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
4. Check the page in light and dark mode, at desktop width and at 375px with no horizontal scroll.
5. `git status` shows no `.env` and no stray files.
6. PR description says what changed, which tables it touches, and how you tested it.
