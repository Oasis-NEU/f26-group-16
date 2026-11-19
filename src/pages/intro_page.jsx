import Logo from '../components/Logo.jsx'
import { primaryButton, secondaryButton } from '../components/ui.jsx'
import ThemeButton from '../components/ThemeButton.jsx'

// Landing page for logged-out visitors. Everything here is static: events are
// only readable once logged in (RLS), so nothing is fetched from the database.

const FEATURES = [
  {
    icon: '📌',
    title: 'Post an event',
    text: 'Study sessions, club meetings, open mics: add a picture, a time, and a place, and it’s on the board.',
  },
  {
    icon: '🙋',
    title: 'Join and see who’s going',
    text: 'Join with one click, see who else is in, and set a headcount limit when space is tight.',
  },
  {
    icon: '💬',
    title: 'Chat with people',
    text: 'Message an organizer directly, or talk with everyone going in the event’s own chat.',
  },
  {
    icon: '🗓️',
    title: 'Plan your week',
    text: 'Your schedule shows everything you joined, flags overlaps, and suggests events that fit your free time.',
  },
]

const STEPS = [
  { title: 'Make an account', text: 'All you need is an email and a password.' },
  { title: 'Browse or post', text: 'Filter events by category and date, or post your own.' },
  { title: 'Join and chat', text: 'Join events, comment, and message the people going.' },
]

function Header({ onLogIn, onSignUp }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="group flex items-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-xl font-extrabold tracking-tight text-ink">NUMeet</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeButton />
          <button
            type="button"
            onClick={onLogIn}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-brand-50 hover:text-ink"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={onSignUp}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            Sign up
          </button>
        </div>
      </div>
    </header>
  )
}

export default function IntroPage({ onLogIn, onSignUp }) {
  return (
    <div className="min-h-screen bg-page">
      <Header onLogIn={onLogIn} onSignUp={onSignUp} />

      <main>
        <section className="bg-brand-50 py-20">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-600">
              <span aria-hidden="true">🐾</span> For the Northeastern campus
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Find what’s happening on campus, <span className="text-brand-500">and who’s going</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
              NUMeet is the event board for Northeastern. Post your event, join someone else’s, and chat with the
              people you’ll see there.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={onSignUp} className={primaryButton}>
                Create an account
              </button>
              <button type="button" onClick={onLogIn} className={secondaryButton}>
                Log in
              </button>
            </div>
            <p className="mt-4 text-sm text-muted">Log in to see the events.</p>
          </div>
        </section>

        <section className="py-20" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="features-heading" className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Everything for campus events
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted">One place to post, join, and talk about them.</p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-2xl border border-line bg-surface p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl"
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-ink">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted">{feature.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-line bg-brand-50 py-16" aria-labelledby="steps-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="steps-heading" className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-white"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl bg-brand-500 px-6 py-12 text-center shadow-md sm:px-12">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to find your people?</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/90">Make an account and see what’s on this week.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onSignUp}
                  className="rounded-xl bg-surface px-6 py-3 font-semibold text-ink shadow-md hover:bg-brand-50"
                >
                  Create an account
                </button>
                <button
                  type="button"
                  onClick={onLogIn}
                  className="rounded-xl border border-white/60 px-6 py-3 font-semibold text-white hover:bg-brand-600"
                >
                  I already have one
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="group mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 text-sm text-muted sm:px-6">
          <Logo className="h-6 w-6" />
          <span>NUMeet · Events on the Northeastern campus</span>
        </div>
      </footer>
    </div>
  )
}
