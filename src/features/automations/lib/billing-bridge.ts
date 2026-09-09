import {
  createInvoice,
  findInvoiceByAppointment,
  findManualInvoiceOn,
} from "@/features/finances/lib/finance-repository"
import { addFinanceRecord } from "@/features/patients/lib/patient-extras-store"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { formatIls } from "@/lib/format-ils"
import type {
  BillingInvoice,
  BillingTreatmentType,
  FinanceRecord,
  InvoiceProvider,
} from "@/types/domain"

/**
 * Turns a completed (or missed) visit into a debt the clinic can chase.
 *
 * A `finances` row is the only place an unpaid visit exists. The clinic bills
 * on a cash basis, so the bookkeeping provider never hears about a visit until
 * it is paid — which means that without this row there is no outstanding
 * balance, nothing on the Finances page, and nothing for a payment reminder to
 * point at. Sending is a separate concern handled by the automation sequence,
 * which links to what this created.
 *
 * This used to write to localStorage regardless of whether the clinic was
 * real. On a live clinic the Finances page reads Postgres, so the "debt" was
 * created in a browser key, overwritten a second later by the real ledger, and
 * a reminder ladder started for an invoice id that existed nowhere the app
 * reads. A patient would have been chased for a charge the practitioner could
 * not see.
 *
 * So: a clinic with real patients gets a real row, and a failure to write one
 * is reported rather than papered over with a browser copy. The localStorage
 * path remains for the demo, which is the only thing it was ever right for.
 */

const STORAGE_KEY_INVOICES = "billing.invoices.v1"

/** Fired after an invoice is written, so open views can re-read. */
export const BILLING_STORE_EVENT = "billing-store-changed"

/** Net terms for auto-issued invoices; also the anchor for the dunning ladder. */
const DUE_DAYS = 7

export interface IssueInvoiceInput {
  patientId: string
  patientName: string
  /**
   * The visit being billed. One invoice per appointment, never two. Absent for
   * a charge raised by hand, which is keyed by patient and day instead.
   */
  appointmentId?: string
  treatmentType: BillingTreatmentType
  amount: number
  /** Clinic-local ISO date the visit happened. */
  visitDate: string
  provider: InvoiceProvider
  /** A missed visit is still billable, but reads differently on the chart. */
  reason?: "visit" | "no_show"
}

export type IssuedInvoice =
  /** `created` is false when this visit had already been invoiced. */
  | { ok: true; invoice: BillingInvoice; created: boolean }
  /** The clinic is real and the row could not be written. No debt exists. */
  | { ok: false; reason: string }

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function notifyChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(BILLING_STORE_EVENT))
}

/**
 * Issue the invoice for a visit.
 *
 * Idempotent on the appointment (or, for a manual charge, on patient and day):
 * replaying the same completion — a double click, a re-run of the planner —
 * returns the existing invoice rather than billing the patient twice.
 */
export async function issueInvoiceForVisit(input: IssueInvoiceInput): Promise<IssuedInvoice> {
  // Patients are the anchor for demo data everywhere, and this is no
  // exception: a configured deploy that is still demonstrating on the mock
  // dataset has mock patient ids, which the ledger's foreign keys would refuse.
  if (await clinicHasPatients()) return issueLive(input)
  return issueLocal(input)
}

async function issueLive(input: IssueInvoiceInput): Promise<IssuedInvoice> {
  const existing = input.appointmentId
    ? await findInvoiceByAppointment(input.appointmentId, formatIls)
    : await findManualInvoiceOn(input.patientId, input.visitDate, formatIls)
  // Could not ask is not "none". Writing here would risk a second invoice for
  // a visit that already has one.
  if (!existing.ok) return existing
  if (existing.invoice) return { ok: true, invoice: existing.invoice, created: false }

  const written = await createInvoice(
    {
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      amount: input.amount,
      treatmentType: input.treatmentType,
      issuedAt: input.visitDate,
      dueAt: addDays(input.visitDate, DUE_DAYS),
    },
    formatIls,
  )
  if (!written.ok) return written

  notifyChanged()
  return { ok: true, invoice: written.invoice, created: true }
}

/* ----------------------------- demo dataset ----------------------------- */

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
    notifyChanged()
  } catch {
    /* quota / private mode */
  }
}

function issueLocal(input: IssueInvoiceInput): IssuedInvoice {
  const key = input.appointmentId ?? `manual-${input.patientId}-${input.visitDate}`
  const id = `inv-auto-${key}`
  const existing = readInvoices().find((i) => i.id === id)
  if (existing) return { ok: true, invoice: existing, created: false }

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

  return { ok: true, invoice, created: true }
}
