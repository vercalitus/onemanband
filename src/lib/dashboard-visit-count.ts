import { todaySchedule } from "@/lib/mock-data"

/**
 * Lets the global app header show the same live visit count as the dashboard calendar
 * without hoisting all appointment state into layout.
 */
let visitCount = todaySchedule.length
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
