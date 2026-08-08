import type { Point } from "@/features/patients/components/body-svgs/spine-curve"

/** Shared long-bone + joint fragments so front/back/side skeletons stay visually consistent. */

export function VertebraeColumn({ points, width = 10, height = 5 }: { points: Point[]; width?: number; height?: number }) {
  return (
    <>
      {points.map((p, i) => (
        <rect key={i} x={p.x - width / 2} y={p.y - height / 2} width={width} height={height} rx={height / 2} />
      ))}
    </>
  )
}

export function ArmBones({ shoulder, elbow, wrist, splay = 4 }: { shoulder: Point; elbow: Point; wrist: Point; splay?: number }) {
  const dx = wrist.x - elbow.x
  const nx = dx >= 0 ? 1 : -1
  return (
    <>
      <circle cx={shoulder.x} cy={shoulder.y} r={5} />
      <path d={`M${shoulder.x},${shoulder.y} L${elbow.x},${elbow.y}`} fill="none" strokeWidth={11} strokeLinecap="round" />
      <path d={`M${elbow.x - splay * nx},${elbow.y} L${wrist.x - splay * nx},${wrist.y}`} fill="none" strokeWidth={4} strokeLinecap="round" />
      <path d={`M${elbow.x + splay * nx},${elbow.y} L${wrist.x + splay * nx},${wrist.y}`} fill="none" strokeWidth={4} strokeLinecap="round" />
      <rect x={wrist.x - 9} y={wrist.y - 3} width={18} height={7} rx={3.5} />
    </>
  )
}

export function LegBones({ hip, knee, ankle, splay = 5 }: { hip: Point; knee: Point; ankle: Point; splay?: number }) {
  const dx = ankle.x - knee.x
  const nx = dx >= 0 ? 1 : -1
  return (
    <>
      <circle cx={hip.x} cy={hip.y} r={5} />
      <path d={`M${hip.x},${hip.y} L${knee.x},${knee.y}`} fill="none" strokeWidth={13} strokeLinecap="round" />
      <path d={`M${knee.x - splay * nx},${knee.y} L${ankle.x - splay * nx},${ankle.y}`} fill="none" strokeWidth={5} strokeLinecap="round" />
      <path d={`M${knee.x + splay * nx},${knee.y} L${ankle.x + splay * nx},${ankle.y}`} fill="none" strokeWidth={5} strokeLinecap="round" />
      <rect x={ankle.x - 13} y={ankle.y - 1} width={26} height={10} rx={5} />
    </>
  )
}
