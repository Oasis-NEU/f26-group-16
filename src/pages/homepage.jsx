import { useEffect, useId, useState } from 'react'
import { listCategories, listEvents } from '../api.jsx'
import EventCard from '../components/EventCard.jsx'
import { ErrorMessage, Notice, inputClass, primaryButton, secondaryButton } from '../components/ui.jsx'
import { categoryEmoji, endOfDay, startOfDay, toDateInput } from '../utils/format.js'
import { NEW_EVENT_PATH } from '../utils/routes.js'

const pillClass = (active) =>
  `inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold ${
    active ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface text-ink hover:bg-brand-50'
  }`

function DateField({ label, ...inputProps }) {
  const id = useId()
  return (
    <div className="min-w-0 flex-1 sm:flex-none">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input id={id} type="date" className={`${inputClass} py-2.5 sm:w-44`} {...inputProps} />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-hidden="true">
      <div className="aspect-video animate-pulse bg-brand-50 motion-reduce:animate-none" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-1/2 rounded bg-line" />
        <div className="h-5 w-4/5 rounded bg-line" />
        <div className="h-4 w-1/3 rounded bg-line" />
      </div>
    </div>
  )
}

const gridClass = 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'

export default function Homepage() {
  const today = toDateInput(new Date())
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState('')
  const [retries, setRetries] = useState(0)
  // Tagged with the filters it was loaded for, so stale results show as loading.
  const [result, setResult] = useState(null)

  const filterKey = [categoryId, fromDate, toDate, retries].join('|')
  const loading = result?.key !== filterKey
  const filtered = categoryId !== '' || fromDate !== today || toDate !== ''

  useEffect(() => {
    // The filters still work without category pills, so a failure here is quiet.
    listCategories()
      .then(setCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const key = [categoryId, fromDate, toDate, retries].join('|')
    listEvents({ categoryId: categoryId || undefined, from: startOfDay(fromDate), to: endOfDay(toDate) })
      .then((events) => !cancelled && setResult({ key, events }))
      .catch((err) => !cancelled && setResult({ key, error: err.message }))
    return () => {
      cancelled = true
    }
  }, [categoryId, fromDate, toDate, retries])

  const clearFilters = () => {
    setCategoryId('')
    setFromDate(today)
    setToDate('')
  }

  let content
  if (!result) {
    content = (
      <div className={gridClass}>
        {[0, 1, 2].map((n) => (
          <CardSkeleton key={n} />
        ))}
      </div>
    )
  } else if (result.error) {
    content = (
      <div className="space-y-4">
        <ErrorMessage message={result.error} />
        <button type="button" onClick={() => setRetries((n) => n + 1)} className={secondaryButton}>
          Try again
        </button>
      </div>
    )
  } else if (result.events.length === 0) {
    content = (
      <Notice icon="🗓️" title={filtered ? 'Nothing matches those filters' : 'No upcoming events yet'}>
        <p>{filtered ? 'Try another category or a wider date range.' : 'Be the first to put something on the calendar.'}</p>
        {filtered ? (
          <button type="button" onClick={clearFilters} className={secondaryButton}>
            Clear filters
          </button>
        ) : (
          <a href={NEW_EVENT_PATH} className={primaryButton}>
            Post an event
          </a>
        )}
      </Notice>
    )
  } else {
    content = (
      <div className={`${gridClass} transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {result.events.map((event) => (
          <EventCard key={event.event_id} event={event} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">What’s happening</h1>
          <p className="mt-2 text-muted">Find something to do on campus, or post your own.</p>
        </div>
        <a href={NEW_EVENT_PATH} className={`${primaryButton} shrink-0`}>
          <span aria-hidden="true">＋</span> Post an event
        </a>
      </div>

      <section aria-label="Filters" className="mt-8 space-y-4">
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoryId('')} aria-pressed={categoryId === ''} className={pillClass(categoryId === '')}>
            All
          </button>
          {categories.map((category) => {
            const active = categoryId === category.category_id
            return (
              <button
                key={category.category_id}
                type="button"
                onClick={() => setCategoryId(category.category_id)}
                aria-pressed={active}
                className={pillClass(active)}
              >
                <span aria-hidden="true">{categoryEmoji(category.category_id)}</span>
                {category.name}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <DateField label="To" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
          {filtered && (
            <button type="button" onClick={clearFilters} className="px-2 py-2.5 text-sm font-semibold text-brand-600 hover:underline">
              Reset filters
            </button>
          )}
        </div>
      </section>

      <section aria-label="Events" aria-busy={loading} className="mt-8">
        {content}
      </section>
    </div>
  )
}
