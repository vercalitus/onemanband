import { addFinanceRecord } from "@/features/patients/lib/patient-extras-store"
import { formatIls } from "@/lib/format-ils"
import type {
  BillingInvoice,
  BillingTreatmentType,
  FinanceRecord,
  InvoiceProvider,
} from "@/types/domain"

/**
 * Turns a completed (or missed) visit into a real invoice.
 *
 * The spec is explicit that the post-treatment invoice is *entered into the
 * financial section and the patient file*, not merely messaged — so this
 * writes two records: a `BillingInvoice` for the Financial OS and a
 * `FinanceRecord` on the patient's chart. Sending is a separate concern
 * handled by the automation sequence, which links to what this created.
 *
 * Mock mode writes straight to the same localStorage keys `useBilling` reads,
 * and fires an event so an open Finances page picks it up. Supabase replaces
 * both writes with one insert into `public.finances`.
 */

const STORAGE_KEY_INVOICES = "billing.invoices.v1"

/** Fired after an automation writes an invoice, so open views can re-read. */
export const BILLING_STORE_EVENT = "billing-store-changed"

/** Net terms for auto-issued invoices; also the anchor for the dunning ladder. */
const DUE_DAYS = 7

function readInvoices(): BillingInvoice[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_INVOICES)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BillingInvoice[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeInvoices(next: BillingInvoice[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(next))
    window.dispatchEvent(new Event(BILLING_STORE_EVENT))
  } catch {
    /* quota / private mode */
  }
}

export interface IssueInvoiceInput {
  patientId: string
  patientName: string
  /** Deterministic id source — one invoice per appointment, never two. */
  appointmentId: string
  treatmentType: BillingTreatmentType
  amount: number
  /** Clinic-local ISO date the visit happened. */
  visitDate: string
  provider: InvoiceProvider
  /** A missed visit is still billable, but reads differently on the chart. */
  reason?: "visit" | "no_show"
}

export interface IssuedInvoice {
  invoice: BillingInvoice
  /** False when this appointment had already been invoiced. */
  created: boolean
}

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * Issue the invoice for a visit.
 *
 * Idempotent on `appointmentId`: replaying the same completion — a double
 * click, a re-run of the planner — returns the existing invoice rather than
 * billing the patient twice.
 */
export function issueInvoiceForVisit(input: IssueInvoiceInput): IssuedInvoice {
  const id = `inv-auto-${input.appointmentId}`
  const existing = readInvoices().find((i) => i.id === id)
  if (existing) return { invoice: existing, created: false }

  const invoice: BillingInvoice = {
    id,
    patientId: input.patientId,
    patientName: input.patientName,
    issuedAt: input.visitDate,
    dueAt: addDays(input.visitDate, DUE_DAYS),
    paidAt: null,
    amount: input.amount,
    displayAmount: formatIls(input.amount),
    status: "issued",
    paymentStatus: "pending",
    treatmentType: input.treatmentType,
    provider: input.provider,
    // Nothing has been pushed to the billing provider yet — saying "synced"
    // here would hide a real failure once a provider is connected.
    syncStatus: "pending",
  }

  writeInvoices([invoice, ...readInvoices()])

  const financeRecord: FinanceRecord = {
    id,
    issuedAt: input.visitDate,
    description:
      input.reason === "no_show"
        ? `Missed appointment — ${input.treatmentType}`
        : `Session — ${input.treatmentType}`,
    amount: invoice.displayAmount,
    invoiceStatus: "issued",
    paymentStatus: "pending",
  }
  addFinanceRecord(input.patientId, financeRecord)

  return { invoice, created: true }
}

/** Look up an auto-issued invoice for an appointment, if one exists. */
export function findInvoiceForAppointment(appointmentId: string): BillingInvoice | null {
  return readInvoices().find((i) => i.id === `inv-auto-${appointmentId}`) ?? null
}

/** Mark an auto-issued invoice paid. The caller stops the dunning ladder. */
export function markInvoicePaid(invoiceId: string): BillingInvoice | null {
  const invoices = readInvoices()
  const target = invoices.find((i) => i.id === invoiceId)
  if (!target) return null
  const paid: BillingInvoice = {
    ...target,
    status: "paid",
    paymentStatus: "paid",
    paidAt: new Date().toISOString().slice(0, 10),
  }
  writeInvoices(invoices.map((i) => (i.id === invoiceId ? paid : i)))
  return paid
}
