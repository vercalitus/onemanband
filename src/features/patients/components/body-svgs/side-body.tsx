export const SIDE_BODY_VIEWBOX = { width: 140, height: 400 }

/** Minimal original silhouette — side/profile view with a soft spine curve. */
export function SideBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIDE_BODY_VIEWBOX.width} ${SIDE_BODY_VIEWBOX.height}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="72" cy="40" r="22" />
      <path d="M70,62 C58,100 80,140 66,190" />
      <path d="M68,95 C48,112 44,150 40,198" />
      <path d="M66,190 L62,280 L58,370" />
    </svg>
  )
}
