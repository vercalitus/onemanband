import type { BillingInvoice, PaymentMethod } from "@/types/domain"

/**
 * What document should exist, and what it should say.
 *
 * Pure. No I/O, no provider, no clock beyond the `now` you pass — so the
 * billing rules can be reasoned about and tested without an account, exactly
 * like `plan-messages.ts` does for reminders. Everything provider-shaped lives
 * in `billing-provider.ts`; everything SUMIT-shaped lives in `sumit-provider.ts`.
 */

export interface TaxDocumentCustomer {
  /**
   * Our patient id, sent as the provider's external identifier. This is what
   * stops a renamed patient from getting a second customer card.
   */
  externalId: string
  name: string
  email?: string
  phone?: string
  address?: string
}

export interface TaxDocumentLineItem {
  /**
   * Treatment type label — and nothing else. A tax document goes to an
   * accounting vendor and to the tax authority; clinical detail has no
   * business being on it.
   */
  name: string
  quantity: number
  unitPrice: number
}

export type TaxDocumentKind =
  | "invoice_receipt"
  | "credit_invoice_receipt"
  | "payment_request"

export interface TaxDocumentRequest {
  kind: TaxDocumentKind
  /**
   * Idempotency key, carried to the provider as an external reference. One
   * visit can only ever produce one tax document, however many times a
   * flaky network makes us ask.
   */
  externalReference: string
  customer: TaxDocumentCustomer
  items: TaxDocumentLineItem[]
  payment?: { amount: number; method: PaymentMethod }
  /**
   * True when the prices we hold already include VAT — which they do: clinic
   * treatment prices in Settings are the number the patient is quoted and
   * pays. The VAT *rate* is never hard-coded; the provider reads it from the
   * accounting system, because it is a number the state changes.
   */
  vatIncluded: boolean
  /** When set, the provider emails the document to the patient itself. */
  emailTo?: string
  /** Clinic-local ISO date (YYYY-MM-DD). */
  issueDate: string
  /** Draft documents get no legal number. Default until a deploy goes live. */
  draft: boolean
  language: "he" | "en" | "ar"
  /** For credits only — the document being reversed. */
  originalDocumentId?: string
  description?: string
}

export interface PlanTaxDocumentInput {
  invoice: BillingInvoice
  /** Display label for the treatment type, in the clinic's language. */
  treatmentLabel: string
  patient: {
    id: string
    fullName: string
    email?: string
    phone?: string
    address?: string
  }
  payment: { amount: number; method: PaymentMethod; date: string }
  language: "he" | "en" | "ar"
  draft: boolean
}

/**
 * Plan the document for a visit that has just been paid for.
 *
 * A single clinician taking payment at the end of a session is a cash-basis
 * business, so the document is always a חשבונית מס קבלה — invoice and receipt
 * in one, issued at the moment the money arrives. There is deliberately no
 * path here that files a document for an unpaid visit: an unpaid visit is a
 * debt the clinic tracks, not a tax event.
 */
export function planPaidVisitDocument(input: PlanTaxDocumentInput): TaxDocumentRequest {
  const { invoice, patient, payment } = input
  return {
    kind: "invoice_receipt",
    externalReference: invoice.appointmentId ?? invoice.id,
    customer: {
      externalId: patient.id,
      name: patient.fullName,
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
    },
    items: [
      {
        name: input.treatmentLabel,
        quantity: 1,
        unitPrice: payment.amount,
      },
    ],
    payment: { amount: payment.amount, method: payment.method },
    vatIncluded: true,
    emailTo: patient.email,
    issueDate: payment.date,
    draft: input.draft,
    language: input.language,
  }
}

/**
 * Plan the reversal of a document that was already filed.
 *
 * A tax document that has been issued cannot be deleted — the only lawful
 * undo is a credit document that points back at it. This is why "void" in the
 * UI has to mean *credited*, not *removed*.
 */
export function planCreditDocument(input: {
  invoice: BillingInvoice
  treatmentLabel: string
  patient: PlanTaxDocumentInput["patient"]
  reason: string
  issueDate: string
  language: "he" | "en" | "ar"
  draft: boolean
}): TaxDocumentRequest | null {
  const original = input.invoice.taxDocument
  if (!original) return null
  return {
    kind: "credit_invoice_receipt",
    externalReference: `credit-${input.invoice.appointmentId ?? input.invoice.id}`,
    customer: {
      externalId: input.patient.id,
      name: input.patient.fullName,
      email: input.patient.email,
      phone: input.patient.phone,
      address: input.patient.address,
    },
    items: [
      { name: input.treatmentLabel, quantity: 1, unitPrice: input.invoice.amount },
    ],
    payment: input.invoice.paymentMethod
      ? { amount: input.invoice.amount, method: input.invoice.paymentMethod }
      : undefined,
    vatIncluded: true,
    emailTo: input.patient.email,
    issueDate: input.issueDate,
    draft: input.draft,
    language: input.language,
    originalDocumentId: original.documentId,
    description: input.reason,
  }
}

/**
 * Reject what a real provider would also reject, so mistakes surface while
 * the simulated provider is still the one running — not on the first live
 * click. Returns a human-readable problem, or null when the plan is sound.
 */
export function validateTaxDocument(request: TaxDocumentRequest): string | null {
  if (!request.externalReference.trim()) return "missing idempotency reference"
  if (!request.customer.externalId.trim()) return "missing patient id"
  if (!request.customer.name.trim()) return "missing patient name"
  if (request.customer.email && !request.customer.email.includes("@")) {
    return "patient email is not an email address"
  }
  if (request.emailTo && !request.emailTo.includes("@")) {
    return "delivery address is not an email address"
  }
  if (!request.items.length) return "document has no line items"
  for (const item of request.items) {
    if (!item.name.trim()) return "line item has no description"
    if (!(item.quantity > 0)) return "line item quantity must be positive"
    if (!(item.unitPrice > 0)) return "line item price must be positive"
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.issueDate)) {
    return `issue date is not a clinic-local ISO date: ${request.issueDate}`
  }
  if (request.kind === "invoice_receipt" && !request.payment) {
    return "an invoice-receipt records money that arrived — payment is required"
  }
  if (request.payment) {
    const total = request.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    // Guarding against the classic split-payment bug before it can file a
    // document whose receipt half disagrees with its invoice half.
    if (Math.abs(total - request.payment.amount) > 0.005) {
      return `payment (${request.payment.amount}) does not match the document total (${total})`
    }
  }
  if (request.kind === "credit_invoice_receipt" && !request.originalDocumentId) {
    return "a credit document must reference the document it reverses"
  }
  return null
}
