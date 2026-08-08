import type { Point } from "@/features/patients/components/body-svgs/spine-curve"

/** Closed outline for a long bone: flared ends (epiphyses), narrower shaft — not just a uniform-width line. */
export function taperedBonePath(x1: number, y1: number, x2: number, y2: number, w1: number, wMid: number, w2: number): string {
  const dx = x2 - x1, dy = y2 - y1
  const px = -dy, py = dx
  const plen = Math.hypot(px, py) || 1
  const ux = px / plen, uy = py / plen
  const pt = (t: number, w: number) => {
    const x = x1 + dx * t, y = y1 + dy * t
    return { lx: x + ux * w, ly: y + uy * w, rx: x - ux * w, ry: y - uy * w }
  }
  const s = pt(0, w1 / 2)
  const q1 = pt(0.28, (w1 * 0.55 + wMid * 0.45) / 2)
  const m = pt(0.5, wMid / 2)
  const q3 = pt(0.72, (w2 * 0.55 + wMid * 0.45) / 2)
  const e = pt(1, w2 / 2)
  return `M${s.lx.toFixed(1)},${s.ly.toFixed(1)} Q${q1.lx.toFixed(1)},${q1.ly.toFixed(1)} ${m.lx.toFixed(1)},${m.ly.toFixed(1)} Q${q3.lx.toFixed(1)},${q3.ly.toFixed(1)} ${e.lx.toFixed(1)},${e.ly.toFixed(1)} L${e.rx.toFixed(1)},${e.ry.toFixed(1)} Q${q3.rx.toFixed(1)},${q3.ry.toFixed(1)} ${m.rx.toFixed(1)},${m.ry.toFixed(1)} Q${q1.rx.toFixed(1)},${q1.ry.toFixed(1)} ${s.rx.toFixed(1)},${s.ry.toFixed(1)} Z`
}

/** Vertebral body + small transverse-process bumps — used to build the spinal column. */
export function Vertebra({ x, y, w = 12, h = 6.5 }: Point & { w?: number; h?: number }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2.3} />
      <circle cx={x - w / 2 - 1.8} cy={y} r={1.7} />
      <circle cx={x + w / 2 + 1.8} cy={y} r={1.7} />
    </g>
  )
}

export function Hand({ x, y }: Point) {
  return (
    <>
      <circle cx={x} cy={y} r={4.5} />
      {[-1, -0.5, 0, 0.5, 1].map((f) => (
        <path
          key={f}
          d={`M${x + f * 3},${y} L${x + f * 5},${y + 10 + Math.abs(f) * 2}`}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </>
  )
}

export function Foot({ x, y, facing = 1 }: Point & { facing?: 1 | -1 }) {
  return (
    <>
      <path
        d={`M${x - facing * 4},${y - 5} Q${x + facing * 8},${y - 6} ${x + facing * 14},${y} Q${x + facing * 8},${y + 6} ${x - facing * 4},${y + 5} Z`}
      />
      {[-2, -1, 0, 1, 2].map((f) => (
        <path
          key={f}
          d={`M${x + facing * 6},${y + f * 2.6} L${x + facing * (14 - Math.abs(f))},${y + f * 3.5}`}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </>
  )
}
