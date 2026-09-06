import { patients } from "@/lib/mock-data"
import { PREVIOUS_MONTH_REVENUE } from "@/lib/mock-finances"
import type {
  BillingInvoice,
  BillingPatientSnapshot,
  BillingTreatmentType,
  ProjectedCalendarVisit,
} from "@/types/domain"

const PATIENT_INDEX = (() => {
  const m = new Map<string, (typeof patients)[number]>()
  for (const p of patients) m.set(p.id, p)
  return m
})()

/**
 * Outstanding balance = sum of every invoice that's been issued but isn't
 * paid yet. Voided invoices and not-yet-issued drafts don't count.
 */
export function computeOutstanding(invoices: BillingInvoice[]): number {
  return invoices.reduce((acc, inv) => {
    if (inv.status === "issued" || inv.status === "overdue") return acc + inv.amount
    return acc
  }, 0)
}

/**
 * Sum of "paidAt" amounts inside the current calendar month. We don't try to
 * be timezone-clever — for this UI "current month" = the user's local month.
 */
export function computeMonthlyRevenue(invoices: BillingInvoice[]): number {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return invoices.reduce((acc, inv) => {
    if (!inv.paidAt) return acc
    const d = new Date(inv.paidAt)
    if (d.getFullYear() === y && d.getMonth() === m) return acc + inv.amount
    return acc
  }, 0)
}

/**
 * Collection rate = paid / (paid + issued + overdue). Voided / draft don't
 * count toward either side. Returns a number 0–100, or null when there's
 * nothing collectible yet.
 */
export function computeCollectionRate(invoices: BillingInvoice[]): number | null {
  let paid = 0
  let collectible = 0
  for (const inv of invoices) {
    if (inv.status === "void" || inv.status === "draft") continue
    collectible += inv.amount
    if (inv.status === "paid") paid += inv.amount
  }
  if (collectible === 0) return null
  return Math.round((paid / collectible) * 100)
}

/**
 * Percent delta between current month and prior month. Used by the trend chip
 * on the Monthly Revenue KPI. Returns null when prior month is 0 (can't
 * compute a percentage).
 */
export function computeMonthlyDeltaPct(
  currentMonth: number,
  /**
   * Last month's takings. Defaults to the demo figure, and callers working
   * with a real ledger pass their own — or null, which is the honest answer
   * for a clinic whose first month this is. Comparing real revenue against an
   * invented previous month produces a confident, meaningless arrow.
   */
  previousMonth: number | null = PREVIOUS_MONTH_REVENUE,
): number | null {
  if (!previousMonth) return null
  return Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
}

/** Sum of estimated fees for visits already scheduled in the mock calendar window. */
export function sumProjectedRevenue(visits: ProjectedCalendarVisit[]): number {
  return visits.reduce((acc, v) => acc + v.estimatedAmount, 0)
}

/**
 * Revenue split by treatment type for the Insights drawer. Only paid invoices
 * count toward "revenue".
 */
export function computeRevenueByTreatment(
  invoices: BillingInvoice[],
  treatmentLabels: Record<BillingTreatmentType, string>,
): Array<{ type: BillingTreatmentType; label: string; revenue: number; share: number }> {
  const totals: Record<BillingTreatmentType, number> = { first: 0, adjustments: 0, kupa: 0 }
  for (const inv of invoices) {
    if (inv.status !== "paid") continue
    totals[inv.treatmentType] += inv.amount
  }
  const sum = totals.first + totals.adjustments + totals.kupa
  const rows: Array<{
    type: BillingTreatmentType
    label: string
    revenue: number
    share: number
  }> = [
    {
      type: "first",
      label: treatmentLabels.first,
      revenue: totals.first,
      share: sum === 0 ? 0 : Math.round((totals.first / sum) * 100),
    },
    {
      type: "adjustments",
      label: treatmentLabels.adjustments,
      revenue: totals.adjustments,
      share: sum === 0 ? 0 : Math.round((totals.adjustments / sum) * 100),
    },
    {
      type: "kupa",
      label: treatmentLabels.kupa,
      revenue: totals.kupa,
      share: sum === 0 ? 0 : Math.round((totals.kupa / sum) * 100),
    },
  ]
  return rows.sort((a, b) => b.revenue - a.revenue)
}

/**
 * Per-patient balance snapshot. Positive = patient owes us; negative = credit
 * on file. Sorted by largest debt first so the debtors list stays useful.
 */
export function computePatientSnapshots(
  invoices: BillingInvoice[],
  formatMoney: (value: number) => string,
): BillingPatientSnapshot[] {
  const map = new Map<string, BillingPatientSnapshot>()
  for (const inv of invoices) {
    const open =
      inv.status === "issued" || inv.status === "overdue" ? inv.amount : 0
    if (open === 0 && !map.has(inv.patientId)) {
      // Still create a settled entry so we can show "Settled" badges.
      map.set(inv.patientId, {
        patientId: inv.patientId,
        patientName: inv.patientName,
        balance: 0,
        displayBalance: formatMoney(0),
        lastVisit: PATIENT_INDEX.get(inv.patientId)?.lastVisit ?? null,
        status: PATIENT_INDEX.get(inv.patientId)?.status ?? "active",
      })
      continue
    }
    const existing = map.get(inv.patientId)
    const balance = (existing?.balance ?? 0) + open
    map.set(inv.patientId, {
      patientId: inv.patientId,
      patientName: inv.patientName,
      balance,
      displayBalance: formatMoney(balance),
      lastVisit: PATIENT_INDEX.get(inv.patientId)?.lastVisit ?? null,
      status: PATIENT_INDEX.get(inv.patientId)?.status ?? "active",
    })
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance)
}
