import { categoryEmoji } from '../utils/format.js'
import { useCategoryPicture } from '../utils/use_category_picture.js'

// An event's cover picture. Without one, its category's default picture, or
// the category glyph on a tinted tile if there's no picture for the category
// either. Size and corners come from `className` (e.g. "aspect-video").
export default function EventPicture({ event, className = '', glyphClass = 'text-5xl' }) {
  const categoryPicture = useCategoryPicture(event.picture_data ? null : event.category_id)
  const src = event.picture_data || categoryPicture
  if (src) {
    return <img src={src} alt="" className={`w-full object-cover ${className}`} />
  }
  return (
    <div className={`flex w-full items-center justify-center bg-brand-50 ${className}`}>
      <span className={glyphClass} aria-hidden="true">
        {categoryEmoji(event.category_id)}
      </span>
    </div>
  )
}
