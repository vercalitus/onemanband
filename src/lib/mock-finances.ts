import { formatIls } from "@/lib/format-ils"
import type {
  BillingInvoice,
  ProjectedCalendarVisit,
  ProviderIntegration,
  UninvoicedVisit,
} from "@/types/domain"

/**
 * Format a number as the clinic's display currency (Israeli shekel).
 * Centralised so KPI cards, invoice rows, and insight charts all show the
 * same shape ("₪120" / "₪1,240").
 */
export function formatCurrency(value: number): string {
  return formatIls(value)
}

/**
 * ISO timestamp helper used by the seed data so "last sync" feels recent on
 * every refresh. We freeze it at import time so the page is stable across
 * client re-renders inside the same session.
 */
const NOW = new Date()
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
const daysAgo = (d: number) => {
  const x = new Date(NOW)
  x.setDate(x.getDate() - d)
  return x.toISOString().slice(0, 10)
}
const daysAhead = (d: number) => {
  const x = new Date(NOW)
  x.setDate(x.getDate() + d)
  return x.toISOString().slice(0, 10)
}

/**
 * Seed catalogue of invoices spanning every state we want the UI to show:
 * paid, issued (awaiting payment), overdue, draft (=needs to be generated &
 * sent), and one void. A couple are marked failed-to-sync so the Integration
 * widget has a real-world error to surface.
 */
export const seedInvoices: BillingInvoice[] = [
  {
    id: "INV-2402",
    patientId: "pt-001",
    patientName: "Maya Green",
    issuedAt: daysAgo(2),
    dueAt: daysAhead(12),
    paidAt: null,
    amount: 120,
    displayAmount: formatCurrency(120),
    status: "issued",
    paymentStatus: "pending",
    treatmentType: "adjustments",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2401",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    issuedAt: daysAgo(4),
    dueAt: daysAhead(10),
    paidAt: daysAgo(1),
    amount: 95,
    displayAmount: formatCurrency(95),
    status: "paid",
    paymentStatus: "paid",
    treatmentType: "adjustments",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2399",
    patientId: "pt-004",
    patientName: "Liam Carter",
    issuedAt: daysAgo(7),
    dueAt: daysAhead(7),
    paidAt: null,
    amount: 180,
    displayAmount: formatCurrency(180),
    status: "issued",
    paymentStatus: "pending",
    treatmentType: "first",
    provider: "Green Invoice",
    syncStatus: "synced",
  },
  {
    id: "INV-2395",
    patientId: "pt-001",
    patientName: "Maya Green",
    issuedAt: daysAgo(14),
    dueAt: daysAgo(1),
    paidAt: null,
    amount: 220,
    displayAmount: formatCurrency(220),
    status: "overdue",
    paymentStatus: "partially_paid",
    treatmentType: "first",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2390",
    patientId: "pt-002",
    patientName: "Noah Stone",
    issuedAt: daysAgo(28),
    dueAt: daysAgo(13),
    paidAt: null,
    amount: 460,
    displayAmount: formatCurrency(460),
    status: "overdue",
    paymentStatus: "pending",
    treatmentType: "kupa",
    provider: "Green Invoice",
    syncStatus: "failed",
  },
  {
    id: "INV-2388",
    patientId: "pt-006",
    patientName: "Ethan Blake",
    issuedAt: daysAgo(30),
    dueAt: daysAgo(15),
    paidAt: null,
    amount: 320,
    displayAmount: formatCurrency(320),
    status: "overdue",
    paymentStatus: "pending",
    treatmentType: "adjustments",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2381",
    patientId: "pt-004",
    patientName: "Liam Carter",
    issuedAt: daysAgo(35),
    dueAt: daysAgo(20),
    paidAt: daysAgo(18),
    amount: 90,
    displayAmount: formatCurrency(90),
    status: "paid",
    paymentStatus: "paid",
    treatmentType: "adjustments",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2375",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    issuedAt: daysAgo(42),
    dueAt: daysAgo(27),
    paidAt: daysAgo(22),
    amount: 140,
    displayAmount: formatCurrency(140),
    status: "paid",
    paymentStatus: "paid",
    treatmentType: "adjustments",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2370",
    patientId: "pt-003",
    patientName: "Ava Hart",
    issuedAt: daysAgo(60),
    dueAt: daysAgo(45),
    paidAt: daysAgo(44),
    amount: 200,
    displayAmount: formatCurrency(200),
    status: "paid",
    paymentStatus: "paid",
    treatmentType: "first",
    provider: "Morning",
    syncStatus: "synced",
  },
  {
    id: "INV-2360",
    patientId: "pt-002",
    patientName: "Noah Stone",
    issuedAt: daysAgo(75),
    dueAt: daysAgo(60),
    paidAt: null,
    amount: 60,
    displayAmount: formatCurrency(60),
    status: "void",
    paymentStatus: "refunded",
    treatmentType: "kupa",
    provider: "Green Invoice",
    syncStatus: "synced",
  },
]

/**
 * Visits that completed but haven't been invoiced. The clinician sees them in
 * the Pending tab and can convert each to an invoice with one click. In
 * production these come from a join on completed appointments minus invoices;
 * here they're hand-authored so the empty/non-empty UI is both visible.
 */
export const seedUninvoicedVisits: UninvoicedVisit[] = [
  {
    id: "visit-001",
    patientId: "pt-003",
    patientName: "Ava Hart",
    visitDate: daysAgo(0),
    treatmentType: "kupa",
    suggestedAmount: 70,
    suggestedDisplayAmount: formatCurrency(70),
  },
  {
    id: "visit-002",
    patientId: "pt-001",
    patientName: "Maya Green",
    visitDate: daysAgo(1),
    treatmentType: "adjustments",
    suggestedAmount: 120,
    suggestedDisplayAmount: formatCurrency(120),
  },
  {
    id: "visit-003",
    patientId: "pt-006",
    patientName: "Ethan Blake",
    visitDate: daysAgo(2),
    treatmentType: "adjustments",
    suggestedAmount: 110,
    suggestedDisplayAmount: formatCurrency(110),
  },
]

/**
 * Provider integration status surfaced in the right-hand widget. Mock-only —
 * real wiring will replace this with a server query.
 */
export const seedIntegration: ProviderIntegration = {
  provider: "Morning",
  connected: true,
  lastSyncAt: minutesAgo(12),
  autoSyncMinutes: 15,
}

/**
 * Previous month total — used only by the Monthly Revenue KPI to compute the
 * delta arrow. Hand-set so the trend looks realistic without us having to
 * fabricate a second month of invoices.
 */
export const PREVIOUS_MONTH_REVENUE: number = 1180

/**
 * Mock appointments for the next 7 rolling days — mirrors the kind of
 * throughput you'd get from `todaySchedule` + a few extra days. Summed in
 * Insights as "Projected Revenue" to show expected collections from work
 * already on the calendar.
 */
export const projectedCalendarWeek: ProjectedCalendarVisit[] = [
  {
    id: "cal-d0-1",
    date: daysAhead(0),
    patientId: "pt-001",
    patientName: "Maya Green",
    treatmentType: "adjustments",
    estimatedAmount: 120,
  },
  {
    id: "cal-d0-2",
    date: daysAhead(0),
    patientId: "pt-003",
    patientName: "Ava Hart",
    treatmentType: "kupa",
    estimatedAmount: 75,
  },
  {
    id: "cal-d1-1",
    date: daysAhead(1),
    patientId: "pt-004",
    patientName: "Liam Carter",
    treatmentType: "first",
    estimatedAmount: 220,
  },
  {
    id: "cal-d1-2",
    date: daysAhead(1),
    patientId: "pt-005",
    patientName: "Sofia Reed",
    treatmentType: "adjustments",
    estimatedAmount: 130,
  },
  {
    id: "cal-d2-1",
    date: daysAhead(2),
    patientId: "pt-002",
    patientName: "Noah Stone",
    treatmentType: "kupa",
    estimatedAmount: 85,
  },
  {
    id: "cal-d2-2",
    date: daysAhead(2),
    patientId: "pt-006",
    patientName: "Ethan Blake",
    treatmentType: "adjustments",
    estimatedAmount: 145,
  },
  {
    id: "cal-d3-1",
    date: daysAhead(3),
    patientId: "pt-001",
    patientName: "Maya Green",
    treatmentType: "first",
    estimatedAmount: 195,
  },
  {
    id: "cal-d4-1",
    date: daysAhead(4),
    patientId: "pt-005",
    patientName: "Sofia Reed",
    treatmentType: "kupa",
    estimatedAmount: 70,
  },
  {
    id: "cal-d5-1",
    date: daysAhead(5),
    patientId: "pt-004",
    patientName: "Liam Carter",
    treatmentType: "adjustments",
    estimatedAmount: 115,
  },
  {
    id: "cal-d6-1",
    date: daysAhead(6),
    patientId: "pt-003",
    patientName: "Ava Hart",
    treatmentType: "adjustments",
    estimatedAmount: 125,
  },
]
