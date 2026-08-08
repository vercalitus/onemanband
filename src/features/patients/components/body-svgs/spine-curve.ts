export interface Point {
  x: number
  y: number
}

function cubicBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const mt = 1 - t
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  }
}

/** Evenly-spaced points along a cubic bezier — used to lay out vertebrae along a spine curve. */
export function pointsAlongCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => cubicBezierPoint(i / (count - 1), p0, p1, p2, p3))
}

/** Evenly-spaced points along a straight segment. */
export function pointsAlongLine(from: Point, to: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  })
}
