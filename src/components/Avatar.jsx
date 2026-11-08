// A user's round profile picture, or the first letter of their name on a tinted
// circle when they have none. Deleted accounts always get the plain 👤 glyph.
// Size comes from `className` (e.g. "h-6 w-6 text-xs").
export default function Avatar({ user, className = 'h-8 w-8 text-sm' }) {
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`

  if (user?.is_active && user.profile_pic_data) {
    return <img src={user.profile_pic_data} alt="" className={`${base} object-cover`} />
  }

  const initial = user?.is_active ? user.full_name?.trim().charAt(0).toUpperCase() : ''
  return (
    <span className={`${base} bg-brand-100 font-bold text-brand-600`} aria-hidden="true">
      {initial || '👤'}
    </span>
  )
}
