/**
 * Lets the global app header show the same live visit count as the dashboard calendar
 * without hoisting all appointment state into layout.
 *
 * Starts at zero rather than at the length of the demo day. The header is
 * rendered on every page, including ones that never load a schedule, so a
 * seeded value stayed on screen unchallenged — a clinic with an empty diary was
 * told it had sixteen visits today, on the same screen the dashboard said none.
 * Whoever knows the real answer sets it.
 */
let visitCount = 0
const listeners = new Set<() => void>()

export function setDashboardVisitCount(n: number) {
  if (!Number.isFinite(n) || n < 0) return
  if (n === visitCount) return
  visitCount = Math.floor(n)
  listeners.forEach((l) => l())
}

export function getDashboardVisitCount(): number {
  return visitCount
}

export function subscribeDashboardVisitCount(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}
