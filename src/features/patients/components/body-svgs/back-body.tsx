import { ArmBones, LegBones, VertebraeColumn } from "@/features/patients/components/body-svgs/limb-parts"
import { pointsAlongLine } from "@/features/patients/components/body-svgs/spine-curve"

export const BACK_BODY_VIEWBOX = { width: 160, height: 400 }

const spine = pointsAlongLine({ x: 80, y: 58 }, { x: 80, y: 196 }, 24)

/** Original simplified posterior skeleton illustration — not derived from any clinical chart. */
export function BackBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${BACK_BODY_VIEWBOX.width} ${BACK_BODY_VIEWBOX.height}`}
      className={className}
      aria-hidden
    >
      <g fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
        {/* Skull */}
        <ellipse cx="80" cy="34" rx="17" ry="21" />

        {/* Full spinal column */}
        <VertebraeColumn points={spine} />
        <path d="M74,196 L86,196 L82,214 L78,214 Z" />

        {/* Scapulae */}
        <path d="M68,96 L48,108 L52,140 L70,130 Z" />
        <path d="M92,96 L112,108 L108,140 L90,130 Z" />

        {/* Pelvis */}
        <path d="M64,178 C46,182 36,195 40,209 C42,216 52,219 64,214 Z" />
        <path d="M96,178 C114,182 124,195 120,209 C118,216 108,219 96,214 Z" />

        <ArmBones shoulder={{ x: 40, y: 96 }} elbow={{ x: 28, y: 150 }} wrist={{ x: 24, y: 206 }} />
        <ArmBones shoulder={{ x: 120, y: 96 }} elbow={{ x: 132, y: 150 }} wrist={{ x: 136, y: 206 }} />
        <LegBones hip={{ x: 58, y: 216 }} knee={{ x: 54, y: 300 }} ankle={{ x: 50, y: 377 }} />
        <LegBones hip={{ x: 102, y: 216 }} knee={{ x: 106, y: 300 }} ankle={{ x: 110, y: 377 }} />
      </g>
    </svg>
  )
}
