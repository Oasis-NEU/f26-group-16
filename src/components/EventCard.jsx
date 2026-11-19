import { hasEnded } from '../utils/archive.js'
import { isFull, joinedCount, spotsLabel } from '../utils/capacity.js'
import { displayName, formatEventTime } from '../utils/format.js'
import { eventPath } from '../utils/routes.js'
import EventPicture from './EventPicture.jsx'

// Event tile for grids (homepage, profile). The whole card links to the detail
// page. `children` renders in a footer below the link, e.g. edit/delete
// buttons on the profile page.
export default function EventCard({ event, children }) {
  // Only events with a headcount limit show "4/10 · 6 spots left".
  const spots = spotsLabel(joinedCount(event), event.max_participants)
  // Ended events stay on the homepage for a day (until archived), and on
  // profiles for good.
  const ended = hasEnded(event)
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <a
        href={eventPath(event.event_id)}
        className="flex flex-1 flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div className="relative">
          <EventPicture event={event} className={`aspect-video ${ended ? 'opacity-60' : ''}`} />
          {ended && (
            <span className="absolute left-3 top-3 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-sm">
              Ended
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-5">
          <p className={`text-sm font-semibold ${ended ? 'text-muted' : 'text-brand-600'}`}>
            {formatEventTime(event.start_time, event.end_time, event.all_day)}
          </p>
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-ink">{event.event_title}</h3>
          {spots && (
            <p className={`text-sm font-semibold ${isFull(event) ? 'text-danger' : 'text-muted'}`}>
              <span aria-hidden="true">👥 </span>
              {spots}
            </p>
          )}
          <p className="mt-auto truncate pt-2 text-sm text-muted">by {displayName(event.organizer)}</p>
        </div>
      </a>
      {children && <div className="flex gap-2 border-t border-line px-5 py-3">{children}</div>}
    </article>
  )
}
