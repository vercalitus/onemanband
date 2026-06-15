import { patients } from "@/lib/mock-data"

/**
 * In the mock data balances are stored as display strings ("₪120", "Settled").
 * We parse them into a numeric balance so the scheduler can show a
 * payment-status dot (debt / settled) on each appointment card.
 */
const balanceByPatient: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  for (const p of patients) {
    const raw = (p.balance ?? "").replace(/[^0-9.-]/g, "")
    const value = Number.parseFloat(raw)
    map[p.id] = Number.isFinite(value) ? value : 0
  }
  return map
})()

export function getPatientBalance(patientId: string): number {
  return balanceByPatient[patientId] ?? 0
}

export function hasOutstandingBalance(patientId: string): boolean {
  return getPatientBalance(patientId) > 0
}
