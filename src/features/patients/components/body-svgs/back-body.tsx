import { Foot, Hand, Vertebra, taperedBonePath } from "@/features/patients/components/body-svgs/bone-shapes"
import { pointsAlongLine } from "@/features/patients/components/body-svgs/spine-curve"

export const BACK_BODY_VIEWBOX = { width: 160, height: 400 }

const spine = pointsAlongLine({ x: 80, y: 60 }, { x: 80, y: 200 }, 24)

/** Original simplified posterior skeleton illustration — not derived from any clinical chart. */
export function BackBody({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${BACK_BODY_VIEWBOX.width} ${BACK_BODY_VIEWBOX.height}`}
      className={className}
      aria-hidden
    >
      <g fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
        {/* Skull (posterior) */}
        <path d="M62,30 C62,12 70,4 80,4 C90,4 98,12 98,30 C98,42 92,50 80,52 C68,50 62,42 62,30 Z" />
        <path d="M80,20 L80,44 M68,30 L92,30" strokeWidth={0.8} opacity={0.5} />

        {/* Full spinal column */}
        {spine.map((p, i) => (
          <Vertebra key={i} x={p.x} y={p.y} w={10.5} h={5.8} />
        ))}
        <path d="M73,200 L87,200 L83,216 Q80,222 77,216 Z" />

        {/* Scapulae */}
        <path d="M70,94 L48,104 Q44,120 58,138 L70,128 Z" />
        <path d="M90,94 L112,104 Q116,120 102,138 L90,128 Z" />

        {/* Clavicles (posterior hint) */}
        <path d="M67,94 Q54,88 41,95" fill="none" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
        <path d="M93,94 Q106,88 119,95" fill="none" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />

        {/* Pelvis */}
        <path d="M72,176 C56,174 42,180 37,192 C34,200 37,208 44,207 C49,206 50,199 55,194 C58,200 62,204 68,204 L70,188 Z" />
        <path d="M88,176 C104,174 118,180 123,192 C126,200 123,208 116,207 C111,206 110,199 105,194 C102,200 98,204 92,204 L90,188 Z" />
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
