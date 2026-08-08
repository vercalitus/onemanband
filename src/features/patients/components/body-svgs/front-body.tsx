import { Foot, Hand, Vertebra, taperedBonePath } from "@/features/patients/components/body-svgs/bone-shapes"
import { pointsAlongLine } from "@/features/patients/components/body-svgs/spine-curve"

export const FRONT_BODY_VIEWBOX = { width: 160, height: 400 }

const cervical = pointsAlongLine({ x: 80, y: 60 }, { x: 80, y: 90 }, 5)

const RIB_COUNT = 9
const ribs = Array.from({ length: RIB_COUNT }, (_, i) => {
  const t = i / (RIB_COUNT - 1)
  const y = 101 + i * 6.6
  const spread = 15 + 10 * Math.sin(t * Math.PI)
  const droop = 7 + 4 * Math.sin(t * Math.PI)
  return { y, spread, droop }
})

/** Original simplified anterior skeleton illustration — not derived from any clinical chart. */
export function FrontBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${FRONT_BODY_VIEWBOX.width} ${FRONT_BODY_VIEWBOX.height}`}
      className={className}
      aria-hidden
    >
      <g fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
        {/* Skull */}
        <path d="M62,30 C62,12 70,4 80,4 C90,4 98,12 98,30 C98,40 94,46 90,50 L90,44 Q80,50 70,44 L70,50 C66,46 62,40 62,30 Z" />
        <path d="M68,48 Q80,64 92,48 Q88,58 80,60 Q72,58 68,48 Z" />
        <ellipse cx="72" cy="28" rx="4.5" ry="5.5" fillOpacity={0.5} />
        <ellipse cx="88" cy="28" rx="4.5" ry="5.5" fillOpacity={0.5} />
        <path d="M78,34 L76,42 L80,43 Z" fill="none" strokeWidth={1} />
        <path d="M67,20 Q80,10 93,20" fill="none" strokeWidth={1} />

        {/* Cervical spine */}
        {cervical.map((p, i) => (
          <Vertebra key={i} x={p.x} y={p.y} w={10} h={5.5} />
        ))}

        {/* Clavicles */}
        <path d="M64,92 Q52,84 40,94" fill="none" strokeWidth={4.5} strokeLinecap="round" />
        <path d="M96,92 Q108,84 120,94" fill="none" strokeWidth={4.5} strokeLinecap="round" />

        {/* Sternum */}
        <path d="M76,97 L84,97 L83,150 Q80,155 77,150 Z" />

        {/* Ribs */}
        {ribs.map((r, i) => (
          <g key={i} fill="none" strokeWidth={1.8} strokeLinecap="round">
            <path
              d={`M76,${r.y} Q${80 - r.spread * 0.65},${r.y - 1} ${80 - r.spread},${r.y + r.droop * 0.6} Q${80 - r.spread + 4},${r.y + r.droop} ${80 - r.spread + 8},${r.y + r.droop + 1.5}`}
            />
            <path
              d={`M84,${r.y} Q${80 + r.spread * 0.65},${r.y - 1} ${80 + r.spread},${r.y + r.droop * 0.6} Q${80 + r.spread - 4},${r.y + r.droop} ${80 + r.spread - 8},${r.y + r.droop + 1.5}`}
            />
          </g>
        ))}

        {/* Pelvis */}
        <path d="M72,176 C56,174 42,180 37,192 C34,200 37,208 44,207 C49,206 50,199 55,194 C58,200 62,204 68,204 L70,188 Z" />
        <path d="M88,176 C104,174 118,180 123,192 C126,200 123,208 116,207 C111,206 110,199 105,194 C102,200 98,204 92,204 L90,188 Z" />
        <path d="M68,204 Q80,212 92,204 L90,188 Q80,196 70,188 Z" />
        <circle cx="55" cy="210" r="5" />
        <circle cx="105" cy="210" r="5" />

        {/* Arms */}
        <path d={taperedBonePath(40, 94, 30, 148, 11, 7, 9)} />
        <circle cx="30" cy="150" r="4" />
        <path d={taperedBonePath(27, 152, 23, 202, 5.5, 3.5, 5.5)} />
        <path d={taperedBonePath(34, 154, 31, 200, 3, 2, 3)} />
        <Hand x={24} y={208} />
        <path d={taperedBonePath(120, 94, 130, 148, 11, 7, 9)} />
        <circle cx="130" cy="150" r="4" />
        <path d={taperedBonePath(133, 152, 137, 202, 5.5, 3.5, 5.5)} />
        <path d={taperedBonePath(126, 154, 129, 200, 3, 2, 3)} />
        <Hand x={136} y={208} />

        {/* Legs */}
        <path d={taperedBonePath(55, 212, 53, 298, 12, 8, 11)} />
        <circle cx="53" cy="300" r="5" />
        <path d={taperedBonePath(52, 304, 48, 372, 6.5, 4.5, 6)} />
        <path d={taperedBonePath(59, 308, 57, 366, 3.5, 2, 3)} />
        <Foot x={48} y={378} facing={-1} />
        <path d={taperedBonePath(105, 212, 107, 298, 12, 8, 11)} />
        <circle cx="107" cy="300" r="5" />
        <path d={taperedBonePath(108, 304, 112, 372, 6.5, 4.5, 6)} />
        <path d={taperedBonePath(101, 308, 103, 366, 3.5, 2, 3)} />
        <Foot x={112} y={378} facing={1} />
      </g>
    </svg>
  )
}
