import { ArmBones, LegBones, VertebraeColumn } from "@/features/patients/components/body-svgs/limb-parts"
import { pointsAlongCubicBezier } from "@/features/patients/components/body-svgs/spine-curve"

export const SIDE_BODY_VIEWBOX = { width: 140, height: 400 }

const spine = pointsAlongCubicBezier(
  { x: 80, y: 56 },
  { x: 64, y: 100 },
  { x: 92, y: 160 },
  { x: 74, y: 200 },
  24,
)

/** Original simplified lateral (profile) skeleton illustration, showing the natural spine curve. */
export function SideBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIDE_BODY_VIEWBOX.width} ${SIDE_BODY_VIEWBOX.height}`}
      className={className}
      aria-hidden
    >
      <g fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
        {/* Skull profile */}
        <ellipse cx="88" cy="36" rx="18" ry="21" />
        <path d="M78,46 Q95,58 106,50 Q98,56 86,54 Z" />
        <circle cx="98" cy="32" r="2.4" fillOpacity={0.45} />

        {/* Ribcage */}
        <ellipse cx="86" cy="122" rx="24" ry="38" fillOpacity={0.12} strokeWidth={1.2} />

        {/* Spine */}
        <VertebraeColumn points={spine} />

        {/* Pelvis */}
        <path d="M74,196 C92,198 96,208 88,218 C80,224 62,222 60,208 C60,200 66,196 74,196 Z" />

        <ArmBones shoulder={{ x: 78, y: 88 }} elbow={{ x: 58, y: 142 }} wrist={{ x: 54, y: 198 }} />
        <LegBones hip={{ x: 72, y: 212 }} knee={{ x: 68, y: 300 }} ankle={{ x: 64, y: 377 }} />
      </g>
    </svg>
  )
}
