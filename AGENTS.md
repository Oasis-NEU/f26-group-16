# AGENTS.md — Rally landing page

Guidance for AI coding agents working on this repo. Follow these conventions so new work matches the existing page.

## Product

Rally is a public event board for college campuses. Students and clubs post events, and others comment on them or message the organizer. Every post has:

- a cover **picture**
- a **title**
- a **description**
- a **start and end** date/time
- a location and organizer

The platform is open to any campus event: study sessions, club meetings, open mics, and so on. Others can join/subscribe to the event (with the number of subscribers displayed on the page), comment on the post, or reach out to the organizer directly (e.g. in-platform direct message, contact info).

Refer to `project.md` file for full details.

## Stack

- React 18 (function components and hooks only)
- Vite 6
- Tailwind CSS v4 via `@tailwindcss/vite`. There is **no** `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme`.
- No router, state library, or UI kit. Don't add dependencies unless the task needs them.

The following commands can be used:

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # must pass before you finish
```

## Project layout

```
index.html                  # page shell + inline script that applies dark mode before first paint
src/
  main.jsx                  # React entry
  index.css                 # Tailwind import, theme tokens, dark overrides, logo animation
  App.jsx                   # all page sections + their copy arrays
  data.js                   # sampleEvents + formatRange() date helper
  components/
    EventCard.jsx           # reusable event post card
    Logo.jsx                # SVG tennis racket logo with wind trails
    ThemeToggle.jsx         # light/dark switch with color swatch
```

- Page sections are small functions inside `App.jsx`, in this order: `Navbar`, `Hero`, `Features`, `HowItWorks` (with `CourtLines`), `Explore`, `UseCases`, `CTA`, `Footer`. Add new sections the same way. Move one into `components/` only once it's reused or grows large.
- Section copy lives in arrays at the top of `App.jsx` (`features`, `steps`, `useCases`). Edit the arrays rather than the JSX.
- Event data has this shape, defined in `data.js`:

  ```js
  { id, title, description, image, start: "YYYY-MM-DDTHH:mm", end, location, organizer, tag }
  ```

## Page appearance and design

### Theme: tennis court, green and white

Colors come from tokens in `src/index.css`. **Never hard-code `slate-*`, `gray-*`, `bg-white`, or hex values in components.** Use the tokens below so dark mode keeps working.

| Token | Use for | Light | Dark |
|---|---|---|---|
| `page` | page background | `#ffffff` | `#0b1711` |
| `surface` | cards, inputs, pills | `#ffffff` | `#12231a` |
| `ink` | headings, primary text | `#0f172a` | `#e8f3ec` |
| `muted` | body and secondary text | `#475569` | `#9db4a6` |
| `line` | borders, dividers, placeholders | `#e2e8f0` | `#22382b` |
| `brand-50` | tinted section backgrounds | `#f0f8f2` | `#10241a` |
| `brand-100` | badges, soft fills | `#d9efdf` | `#173524` |
| `brand-500` | primary buttons, accent text | `#2e8b57` | same |
| `brand-600` | hover states, links, dates | `#24744a` | `#4cbb7c` |
| `brand-700` | court section background, solid buttons | `#1c5d3b` | same |
| `brand-900` | darkest accent | `#123d27` | `#0a2216` |

Examples: `bg-page`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-brand-500 hover:bg-brand-600`.

- Dark mode is class-based (`.dark` on `<html>`), declared with `@custom-variant dark` in `index.css`. To add a new color, define it in `@theme` **and** override it in the `.dark` block.
- Use `dark:` utilities only for one-off fixes, such as `dark:text-brand-600` on the hero badge.
- `bg-white` and `text-white` are fine **only** on top of fixed green fills (buttons, the "How it works" court section, the CTA box, logo strokes).

### Layout and components

- Container: `mx-auto max-w-6xl px-4 sm:px-6`. Section padding is `py-20`, or `py-16` for lighter bands.
- Corners: `rounded-lg` (small buttons) · `rounded-xl` (large buttons, inputs, icon tiles) · `rounded-2xl` (cards) · `rounded-3xl` (CTA panel) · `rounded-full` (pills, badges).
- Headings: `text-3xl font-extrabold tracking-tight sm:text-4xl` for sections and `text-4xl … lg:text-6xl` for the hero.
- Primary button: `rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-brand-600`.
- Secondary button: `rounded-xl border border-line bg-surface px-6 py-3 font-semibold text-ink hover:bg-brand-50`.
- Cards: `rounded-2xl border border-line bg-surface shadow-sm`, lifting on hover (`hover:-translate-y-1 hover:shadow-lg`).
- Icons are emoji in a `bg-brand-50` rounded tile. Don't add an icon library unless asked.
- Mobile-first: the page must work at 375px wide with no horizontal scroll. The navbar collapses into a ☰ menu below `md`.

### Signature details (keep these)

- **Logo** (`Logo.jsx`): an upright white tennis racket centered on a `bg-brand-500` tile, with three wind trails on its left. When the parent `.group` is hovered, it winds up and **swings down** around the handle (`racket-swing` keyframes in `index.css`), and the trails streak in. Respect `prefers-reduced-motion`.
- **Court lines** (`CourtLines` in `App.jsx`): faint white SVG court markings behind the "How it works" section.
- **Theme toggle** (`ThemeToggle.jsx`): sits at the top right of the navbar on every screen size. It has a sun/moon knob and a four-dot swatch (`page`, `brand-100`, `brand-500`, `ink`) that recolors itself when the theme flips. The choice is saved in `localStorage` under `rally-theme`, falling back to the OS preference. Keep the matching inline script in `index.html` in sync.

### Accessibility

- Decorative SVGs get `aria-hidden="true"`. Icon-only buttons get an `aria-label`.
- The theme toggle is a `role="switch"` with `aria-checked`.
- Inputs without visible labels need an `aria-label`.
- Animations must be disabled under `prefers-reduced-motion: reduce`.

## Finalizing each change

1. Run `npm run build`, and it must succeed.
2. Check the page in **both** light and dark mode, at desktop width and at 375px.
3. Make sure no new hard-coded neutral colors slipped in:

   ```bash
   grep -rnE '(text|bg|border|ring|from|to)-(slate|gray)-[0-9]|bg-white' src
   ```

   The only expected hits are the white step circles in the court section (`App.jsx`) and the toggle knob (`ThemeToggle.jsx`).
