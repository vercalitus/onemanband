export const BACK_BODY_VIEWBOX = { width: 160, height: 400 }

/** Minimal original silhouette — back view, with a subtle spine reference line. */
export function BackBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${BACK_BODY_VIEWBOX.width} ${BACK_BODY_VIEWBOX.height}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="80" cy="40" r="22" />
      <path d="M80,68 L80,190" />
      <path d="M46,92 L114,92" />
      <path d="M46,92 L34,150 L30,210" />
      <path d="M114,92 L126,150 L130,210" />
      <path d="M58,190 L102,190" />
      <path d="M58,190 L54,280 L50,370" />
      <path d="M102,190 L106,280 L110,370" />
      {/* Subtle spine reference dots — abstract, not a labeled vertebra chart. */}
      <g strokeWidth={4} strokeDasharray="0.5 10" opacity={0.55}>
        <path d="M80,68 L80,190" />
      </g>
    </svg>
  )
}
