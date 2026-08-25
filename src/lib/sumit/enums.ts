/**
 * SUMIT API enums.
 *
 * SUMIT's OpenAPI declares these as named string enums, but its own request
 * examples send the numeric value (`"Type": 1`). Numbers are what we send —
 * they are what the published example uses and what the help centre documents
 * — and these constants keep the call sites readable.
 *
 * Source: https://app.sumit.co.il/swagger/v1/swagger.json
 */

/** Document kinds. The clinic only ever issues 1, 6 and 13. */
export const SumitDocumentType = {
  Invoice: 0,
  /** חשבונית מס קבלה — issued once payment has actually been taken. */
  InvoiceAndReceipt: 1,
  Receipt: 2,
  ProformaInvoice: 3,
  CreditInvoice: 5,
  /** חשבונית זיכוי קבלה — the only lawful way to undo an InvoiceAndReceipt. */
  CreditInvoiceAndReceipt: 6,
  CreditReceipt: 7,
  PriceQuotation: 12,
  /** דרישת תשלום — chases a debt without creating a tax event. */
  PaymentRequest: 13,
} as const

export type SumitDocumentTypeValue =
  (typeof SumitDocumentType)[keyof typeof SumitDocumentType]

/** How the money actually arrived. Recorded on the receipt half of the document. */
export const SumitPaymentType = {
  Automatic: 0,
  General: 1,
  Cash: 2,
  BankTransfer: 3,
  Cheque: 4,
  CreditCard: 5,
  /** Bit, PayBox, Apple Pay and friends. */
  Digital: 6,
  TaxWithholding: 7,
  Other: 8,
} as const

export type SumitPaymentTypeValue =
  (typeof SumitPaymentType)[keyof typeof SumitPaymentType]

/**
 * How SUMIT decides whether an incoming customer is one it already holds.
 *
 * `ExternalIdentifier` is the only safe choice for us: it matches on the id we
 * send (the patient id), so a patient whose name or email later changes still
 * resolves to the same customer card instead of spawning a duplicate.
 */
export const SumitCustomerSearchMode = {
  Automatic: 0,
  None: 1,
  ExternalIdentifier: 2,
  Name: 3,
  CompanyNumber: 4,
  Phone: 5,
  EmailAddress: 6,
} as const

/** Envelope status returned by every SUMIT endpoint. */
export type SumitResponseStatus = "Success" | "BusinessError" | "TechnicalError"
