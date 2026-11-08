import { displayName } from '../utils/format.js'
import { profilePath } from '../utils/routes.js'

// A user's name linking to their profile, or plain text for deleted accounts.
// `onClick` lets popups close themselves when the link is followed.
export default function UserName({ user, className = '', onClick }) {
  if (!user?.is_active) return <span className={`text-muted ${className}`}>{displayName(user)}</span>
  return (
    <a href={profilePath(user.uid)} onClick={onClick} className={`text-ink hover:text-brand-600 hover:underline ${className}`}>
      {user.full_name}
    </a>
  )
}
