// Upright tennis racket with three wind trails on a green tile. Place it inside
// a `.group` element: hovering the group swings the racket down around its
// handle and streaks the trails in (keyframes in index.css).
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white ${className}`}>
      <svg viewBox="0 0 40 40" className="h-full w-full" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
        <g strokeWidth="1.8">
          <line className="logo-trail" x1="7" y1="11" x2="13" y2="11" />
          <line className="logo-trail" x1="5" y1="15.5" x2="13" y2="15.5" />
          <line className="logo-trail" x1="8" y1="20" x2="13" y2="20" />
        </g>
        <g className="logo-racket">
          <ellipse cx="24" cy="14" rx="7" ry="9" strokeWidth="2" />
          <path d="M19 10h10M18 14h12M19 18h10M21 6.5v15M24 5.5v17M27 6.5v15" strokeWidth="0.8" opacity="0.8" />
          <path d="M21.5 22.5 24 27l2.5-4.5" strokeWidth="1.6" />
          <line x1="24" y1="27" x2="24" y2="35" strokeWidth="3" />
        </g>
      </svg>
    </span>
  )
}
