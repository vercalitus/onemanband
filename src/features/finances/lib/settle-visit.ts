import { settleLocalInvoice } from "@/features/automations/lib/billing-bridge"
import { onInvoicePaid } from "@/features/automations/lib/events"
import { clearRemoteClaim } from "@/features/automations/lib/remote-responses"
import { settleInvoiceRow } from "@/features/finances/lib/finance-repository"
import { planPaidVisitDocument } from "@/features/finances/lib/plan-tax-document"
import { fileTaxDocument } from "@/features/finances/lib/tax-documents"
import { linkSumitCustomer } from "@/features/patients/lib/patient-repository"
import { createTranslator } from "@/lib/i18n/dictionary"
import type { BillingInvoice, PatientSummary, PaymentMethod } from "@/types/domain"

/**
 * Record that a visit was paid for, and file the tax document.
 *
 * These are one action because they are one event. A single-practitioner clinic
 * bills on a cash basis, so the document is a חשבונית מס קבלה — invoice and
 * receipt together — and it only comes into existence once the money has
 * actually arrived. Marking paid without filing would leave income
 * undocumented; filing without payment would invent a tax event.
 *
 * It lives here, outside any hook, because there are now two places a visit
 * gets paid for: the Finances page, and the moment the practitioner closes the
 * session with the patient in front of him. Two copies of this would be two
 * ways to talk to the bookkeeping account, and only one of them would stay
 * right.
 *
 * The invoice is marked paid whatever the filing does. A failed filing is a
 * bookkeeping problem to retry, not a reason to pretend the patient did not
 * pay — `syncStatus` carries that separately.
 */

/**
 * Translator pinned to Hebrew, for text that ends up on a tax document rather
 * than on the practitioner's screen. See `DOCUMENT_LANGUAGE` in
 * `plan-tax-document.ts` for why the document never follows the UI locale.
 */
const he = createTranslator("he")

export interface VisitPayment {
  amount: number
  method: PaymentMethod
  /** Clinic-local ISO date the money arrived. */
  date: string
}

export type SettleVisitResult = {
  /** What the filing did. `simulated` means no provider is configured. */
  outcome: "filed" | "draft" | "simulated" | "blocked" | "failed"
  /** Provider-side document number, when one was really issued. */
  documentNumber?: string
  /** Why the filing did not happen. Present for `blocked` and `failed`. */
  error?: string
  /** What the caller should merge into its copy of the invoice. */
  patch: Partial<BillingInvoice>
}

/**
 * The one sentence the practitioner reads about a settlement, in their own
 * language. Shared with the chart so the same filing never reads as a success
 * on one screen and a warning on the other.
 */
export function settleMessage(
  result: SettleVisitResult,
  t: (key: string, params?: Record<string, string | number>) => string,
): { ok: boolean; blocked?: boolean; message: string } {
  switch (result.outcome) {
    case "simulated":
      return { ok: true, message: t("billing.payment.result.simulated") }
    case "draft":
      return { ok: true, message: t("billing.payment.result.draft") }
    case "filed":
      return {
        ok: true,
        message: t("billing.payment.result.filed", { number: result.documentNumber ?? "—" }),
      }
    case "blocked":
      return { ok: false, blocked: true, message: t("billing.payment.result.blocked") }
    default:
      return {
        ok: false,
        message: t("billing.payment.result.failed", { reason: result.error ?? "" }),
      }
  }
}

export async function settleVisit(input: {
  invoice: BillingInvoice
  /** The clinic's own record, for the customer card at the provider. */
  patient: PatientSummary | undefined
  payment: VisitPayment
  /** True when the ledger is Postgres rather than the demo's browser copy. */
  live: boolean
  formatMoney: (amount: number) => string
}): Promise<SettleVisitResult> {
  const { invoice, patient, payment, live, formatMoney } = input

  const request = planPaidVisitDocument({
    invoice,
    treatmentLabel: he(`billing.treatment.${invoice.treatmentType}`),
    patient: {
      id: invoice.patientId,
      fullName: patient?.fullName ?? invoice.patientName,
      email: patient?.email,
      phone: patient?.phone,
      address: patient?.address,
      sumitCustomerId: patient?.sumitCustomerId,
    },
    payment,
    // Overridden server-side; the deploy decides, not the browser.
    draft: true,
  })

  const filing = await fileTaxDocument(request, { invoiceId: invoice.id })

  // A patient with no card had one made for them just now. Remember which, so
  // the next document names it instead of searching — and so the link is ours,
  // not only SUMIT's.
  if (filing.status === "filed" && !patient?.sumitCustomerId && filing.document.customerId) {
    const customerId = Number(filing.document.customerId)
    if (Number.isFinite(customerId)) void linkSumitCustomer(invoice.patientId, customerId)
  }

  const paidFields: Partial<BillingInvoice> = {
    status: "paid",
    paymentStatus: "paid",
    paidAt: payment.date,
    amount: payment.amount,
    displayAmount: formatMoney(payment.amount),
    paymentMethod: payment.method,
  }

  const patch: Partial<BillingInvoice> =
    filing.status === "filed"
      ? {
          ...paidFields,
          syncStatus: filing.document.provider === "simulated" ? "simulated" : "synced",
          taxDocument: filing.document,
          syncError: undefined,
        }
      : { ...paidFields, syncStatus: "failed", syncError: filing.message }

  // The patient has paid — stop chasing them, whatever the filing did.
  onInvoicePaid(invoice.id)
  // And close the claim where it actually lives. The patient may have tapped
  // "I've already paid" on their own phone, so the open row is in the database,
  // not in this browser.
  clearRemoteClaim(invoice.id)

  // Write the settlement down. The filing outcome goes with it, whatever it
  // was: an invoice can be paid and its document missing, and that pair has to
  // survive a refresh or the money is recorded with no receipt and no trace of
  // why.
  if (live) {
    void settleInvoiceRow(
      {
        id: invoice.id,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.date,
        syncStatus: (patch.syncStatus as BillingInvoice["syncStatus"]) ?? "pending",
        taxDocument: patch.taxDocument,
        syncError: patch.syncError,
      },
      formatMoney,
    )
  } else {
    // The demo keeps its ledger in the browser, and a caller that holds no
    // copy of it — the patient chart — would otherwise settle nothing at all.
    settleLocalInvoice(invoice.id, patch)
  }

  if (filing.status === "filed") {
    if (filing.document.provider === "simulated") return { outcome: "simulated", patch }
    if (filing.document.draft) return { outcome: "draft", patch }
    return {
      outcome: "filed",
      documentNumber: String(filing.document.documentNumber ?? "—"),
      patch,
    }
  }

  return {
    outcome: filing.status === "blocked" ? "blocked" : "failed",
    error: filing.message,
    patch,
  }
}
