import { categoryEmoji } from '../utils/format.js'

// An event's cover picture, or its category glyph on a tinted tile when it
// has none. Size and corners come from `className` (e.g. "aspect-video").
export default function EventPicture({ event, className = '', glyphClass = 'text-5xl' }) {
  if (event.picture_data) {
    return <img src={event.picture_data} alt="" className={`w-full object-cover ${className}`} />
  }
  return (
    <div className={`flex w-full items-center justify-center bg-brand-50 ${className}`}>
      <span className={glyphClass} aria-hidden="true">
        {categoryEmoji(event.category_id)}
      </span>
    </div>
  )
}
