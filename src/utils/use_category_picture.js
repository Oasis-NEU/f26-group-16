import { useEffect, useState } from 'react'
import { categoryPictures } from '../api.jsx'

// Category pictures, once loaded, so later pictures show without waiting.
let loadedPictures = null

// The default cover picture for a category (event_categories.picture_data),
// or null while loading, on failure, or when the category has none.
export function useCategoryPicture(categoryId) {
  const [pictures, setPictures] = useState(loadedPictures)
  useEffect(() => {
    if (pictures || !categoryId) return
    let cancelled = false
    categoryPictures()
      .then((map) => {
        loadedPictures = map
        if (!cancelled) setPictures(map)
      })
      // Quiet: the category glyph is shown instead.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pictures, categoryId])
  return (categoryId && pictures?.[categoryId]) || null
}
