// When an event is over. Two steps:
//   ended:    its end has passed (no end time counts as an hour long). It
//             can't be joined anymore (the database checks too).
//   archived: it drops off the homepage and schedule suggestions. Right after
//             the last day of an all-day event, otherwise 24 hours after it
//             ends. Mirrors the generated events.archive_time column in
//             docs/main_schema.sql.
// Both still open by link.

import { eventEnd } from './schedule.js'

export const ARCHIVE_DELAY = 24 * 60 * 60

const nowSeconds = () => Math.floor(Date.now() / 1000)

export const hasEnded = (event, now = nowSeconds()) => eventEnd(event) <= now

export function archiveTime(event) {
  if (event.archive_time != null) return event.archive_time
  // All-day events end at 23:59:59 of their last day.
  return event.all_day ? event.end_time + 1 : eventEnd(event) + ARCHIVE_DELAY
}

export const isArchived = (event, now = nowSeconds()) => archiveTime(event) <= now
