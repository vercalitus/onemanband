import type { BillingInvoice } from "@/types/domain"

/**
 * What to call an invoice on screen.
 *
 * A live row is keyed by the uuid the database minted, and the billing page
 * printed it: "84b6f48f-c54e-4fe7-a239-0b0d985c0179 · Adjustments". That
 * identifies the row to Postgres and nothing to a practitioner.
 *
 * The number a person can use is the tax document's, and it exists only once
 * the money has arrived and the document has been filed — a debt has no
 * number, because no document exists yet. So: the document number when there
 * is one, the demo's own readable ids when running on the demo, and otherwise
 * nothing. The date and the patient beside it are what the row is found by.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function invoiceReference(invoice: BillingInvoice): string | null {
  const number = invoice.taxDocument?.documentNumber
  if (number) return `#${number}`
  if (UUID.test(invoice.id)) return null
  return invoice.id
}

/** Join the parts of a row's subtitle, dropping the ones that have nothing to say. */
export function joinSubtitle(parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => !!part && part.trim().length > 0).join(" · ")
}
