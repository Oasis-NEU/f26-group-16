// Husky head in profile, with three bark arcs off its snout, on a red tile.
// Place it inside a `.group` element: hovering the group makes the husky rear
// back and bark twice, its jaw opening and the arcs pulsing out (keyframes in
// index.css).
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500 text-white ${className}`}>
      <svg viewBox="0 0 40 40" className="h-full w-full" fill="currentColor" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6">
          <path className="logo-bark" d="M33.5 17.5q1.6 2.5 0 5" />
          <path className="logo-bark" d="M35.8 15.8q2.2 4.2 0 8.4" />
          <path className="logo-bark" d="M38 14q2.6 6 0 12" />
        </g>
        <g className="logo-husky">
          <path
            className="logo-jaw"
            d="M20.3 23.9L28.1 22.8C28.5 24.5 26.6 26.3 23.2 26.7C21.4 26.9 19.9 26.2 19.2 25Z"
          />
          {/* Head, muzzle, and neck ruff */}
          <path
            d="M4.6 40.9L5.2 34.2L3.5 32.5L5.7 30.3L4.1 27.5L6.9 24.7C7.4 21.3 8 18.5 9.1 15.7L11.3 4.5L18.1 12.4C20.3 12.9 21.8 14.4 22.8 15.9L29.9 18.5C31.6 19.2 31.7 21.7 29.9 22.1L20.3 23.9C19.6 26.4 18.7 28.4 17.4 30.2L18.7 31.8L16 32.7L17.4 34.7L14.7 35.6L15.6 40.9Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Husky mask over the ear, crown, and back of the head */}
          <path
            className="fill-brand-500"
            d="M9.1 15.7L11.3 4.5L18.1 12.4C20.3 12.9 21.8 14.4 22.8 15.9C22.1 18.1 20.3 19.2 18.1 19.4C15.3 19.9 13 21.9 10.8 25.3C9.1 27.3 7.2 28.4 4.8 28.8L4.1 27.5L6.9 24.7C7.4 21.3 8 18.5 9.1 15.7Z"
          />
          <path d="M12 9L16 13.4L10.9 15.6Z" opacity="0.85" />
          <ellipse cx="16.5" cy="14.5" rx="1.4" ry="0.8" transform="rotate(-15 16.5 14.5)" />
          <path d="M17.9 17Q19.6 15.6 21.4 16.6Q19.9 18.1 17.9 17Z" />
          <circle className="fill-brand-900" cx="19.7" cy="16.7" r="0.6" />
          <ellipse className="fill-brand-900" cx="30" cy="20.2" rx="1.5" ry="1.2" />
        </g>
      </svg>
    </span>
  )
}
