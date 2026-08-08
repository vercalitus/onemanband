import { ArmBones, LegBones, VertebraeColumn } from "@/features/patients/components/body-svgs/limb-parts"
import { pointsAlongLine } from "@/features/patients/components/body-svgs/spine-curve"

export const FRONT_BODY_VIEWBOX = { width: 160, height: 400 }

const RIB_COUNT = 7
const ribs = Array.from({ length: RIB_COUNT }, (_, i) => {
  const y = 102 + i * 9
  const spread = 24 + 10 * Math.sin((i / (RIB_COUNT - 1)) * Math.PI)
  return { y, spread }
})

const cervical = pointsAlongLine({ x: 80, y: 60 }, { x: 80, y: 90 }, 5)

/** Original simplified anterior skeleton illustration — not derived from any clinical chart. */
export function FrontBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${FRONT_BODY_VIEWBOX.width} ${FRONT_BODY_VIEWBOX.height}`}
      className={className}
      aria-hidden
    >
      <g fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
        {/* Skull */}
        <ellipse cx="80" cy="34" rx="17" ry="21" />
        <path d="M65,46 Q80,60 95,46 Q92,54 80,58 Q68,54 65,46 Z" />
        <circle cx="73" cy="32" r="2.6" fillOpacity={0.45} />
        <circle cx="87" cy="32" r="2.6" fillOpacity={0.45} />

        {/* Cervical spine */}
        <VertebraeColumn points={cervical} />

        {/* Clavicles */}
        <path d="M64,92 Q52,86 41,94" fill="none" strokeWidth={4} strokeLinecap="round" />
        <path d="M96,92 Q108,86 119,94" fill="none" strokeWidth={4} strokeLinecap="round" />

        {/* Sternum */}
        <rect x="76" y="97" width="8" height="55" rx="3" />

        {/* Ribs */}
        {ribs.map((r, i) => (
          <g key={`rib${i}`} fill="none" strokeWidth={2.5} strokeLinecap="round">
            <path d={`M76,${r.y} Q${80 - r.spread},${r.y + 2} ${80 - r.spread + 5},${r.y + 13}`} />
            <path d={`M84,${r.y} Q${80 + r.spread},${r.y + 2} ${80 + r.spread - 5},${r.y + 13}`} />
          </g>
        ))}

        {/* Pelvis */}
        <path d="M64,176 C46,180 36,193 40,209 C42,217 52,221 64,215 Z" />
        <path d="M96,176 C114,180 124,193 120,209 C118,217 108,221 96,215 Z" />
        <rect x="77" y="212" width="6" height="12" rx="2" />

        <ArmBones shoulder={{ x: 40, y: 94 }} elbow={{ x: 28, y: 150 }} wrist={{ x: 24, y: 206 }} />
        <ArmBones shoulder={{ x: 120, y: 94 }} elbow={{ x: 132, y: 150 }} wrist={{ x: 136, y: 206 }} />
        <LegBones hip={{ x: 58, y: 216 }} knee={{ x: 54, y: 300 }} ankle={{ x: 50, y: 377 }} />
        <LegBones hip={{ x: 102, y: 216 }} knee={{ x: 106, y: 300 }} ankle={{ x: 110, y: 377 }} />
      </g>
    </svg>
  )
}
