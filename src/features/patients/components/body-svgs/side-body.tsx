import { Foot, Hand, Vertebra, taperedBonePath } from "@/features/patients/components/body-svgs/bone-shapes"
import { pointsAlongCubicBezier } from "@/features/patients/components/body-svgs/spine-curve"

export const SIDE_BODY_VIEWBOX = { width: 140, height: 400 }

const spine = [
  ...pointsAlongCubicBezier({ x: 78, y: 56 }, { x: 90, y: 75 }, { x: 90, y: 95 }, { x: 68, y: 120 }, 12),
  ...pointsAlongCubicBezier({ x: 68, y: 120 }, { x: 50, y: 145 }, { x: 60, y: 175 }, { x: 84, y: 205 }, 12).slice(1),
]

/** Original simplified lateral (profile) skeleton illustration, showing the natural spine curve. */
export function SideBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIDE_BODY_VIEWBOX.width} ${SIDE_BODY_VIEWBOX.height}`}
      className={className}
      aria-hidden
    >
      <g fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
        {/* Skull profile */}
        <ellipse cx="90" cy="32" rx="19" ry="22" />
        <path d="M76,46 Q94,62 108,52 Q100,58 88,58 Q78,56 76,46 Z" />
        <ellipse cx="98" cy="30" rx="4.5" ry="5.5" fillOpacity={0.5} />
        <path d="M104,34 L109,41 L102,42 Z" fill="none" strokeWidth={1} />
        <path d="M82,19 Q94,13 105,21" fill="none" strokeWidth={1} />

        {/* Ribcage */}
        <ellipse cx="86" cy="130" rx="25" ry="43" fillOpacity={0.45} strokeWidth={1.1} />

        {/* Spine */}
        {spine.map((p, i) => (
          <Vertebra key={i} x={p.x} y={p.y} w={10} h={5.5} />
        ))}

        {/* Pelvis */}
        <path d="M84,201 C101,203 106,214 97,224 C89,231 68,229 64,215 C63,207 72,201 84,201 Z" />
        <circle cx="74" cy="214" r="5" />

        {/* Arm */}
        <path d={taperedBonePath(66, 90, 54, 146, 11, 7, 9)} />
        <circle cx="54" cy="148" r="4" />
        <path d={taperedBonePath(51, 152, 46, 200, 5.5, 3.5, 5.5)} />
        <path d={taperedBonePath(58, 154, 54, 198, 3, 2, 3)} />
        <Hand x={44} y={206} />

        {/* Leg */}
        <path d={taperedBonePath(74, 216, 70, 300, 13, 8, 11)} />
        <circle cx="70" cy="302" r="5" />
        <path d={taperedBonePath(68, 306, 64, 372, 6.5, 4.5, 6)} />
        <path d={taperedBonePath(75, 310, 72, 368, 3.5, 2, 3)} />
        <Foot x={64} y={378} facing={1} />
      </g>
    </svg>
  )
}
