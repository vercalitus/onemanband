import type {
  BillingProvider,
  IssueResult,
  PingResult,
} from "@/features/finances/lib/billing-provider"
import { validateTaxDocument, type TaxDocumentRequest } from "@/features/finances/lib/plan-tax-document"
import {
  SumitCustomerSearchMode,
  SumitDocumentType,
  SumitPaymentType,
} from "@/lib/sumit/enums"
import { sumitPost } from "@/lib/sumit/client"
import type { PaymentMethod } from "@/types/domain"

/**
 * SUMIT implementation of the filing boundary. **Server-only** — it reaches
 * `sumitPost`, which reads the private API key from the environment.
 *
 * This file is the entire translation layer between our vocabulary and
 * SUMIT's. Nothing above it knows what a `DocumentType` enum is.
 */

const PAYMENT_TYPE: Record<PaymentMethod, number> = {
  cash: SumitPaymentType.Cash,
  bank_transfer: SumitPaymentType.BankTransfer,
  cheque: SumitPaymentType.Cheque,
  credit_card: SumitPaymentType.CreditCard,
  digital: SumitPaymentType.Digital,
}

const DOCUMENT_TYPE = {
  invoice_receipt: SumitDocumentType.InvoiceAndReceipt,
  credit_invoice_receipt: SumitDocumentType.CreditInvoiceAndReceipt,
  payment_request: SumitDocumentType.PaymentRequest,
} as const

const LANGUAGE = { he: 0, en: 1, ar: 2 } as const

interface CreateDocumentResponse {
  DocumentID: number
  DocumentNumber: number | null
  CustomerID: number
  DocumentDownloadURL: string | null
  DocumentPaymentURL: string | null
}

interface GetVATRateResponse {
  Rate: number
}

function toSumitPayload(request: TaxDocumentRequest): Record<string, unknown> {
  return {
    Details: {
      Type: DOCUMENT_TYPE[request.kind],
      // Drafts carry no legal number. This is the safety valve that lets the
      // whole flow be exercised against a real account without filing.
      IsDraft: request.draft ? true : null,
      Date: request.issueDate,
      Language: LANGUAGE[request.language],
      Customer: {
        // Matching on our patient id — not on name or email, either of which
        // a patient may change — is what keeps one patient to one customer card.
        SearchMode: SumitCustomerSearchMode.ExternalIdentifier,
        ExternalIdentifier: request.customer.externalId,
        Name: request.customer.name,
        EmailAddress: request.customer.email ?? null,
        Phone: request.customer.phone ?? null,
        Address: request.customer.address ?? null,
      },
      // SUMIT does the sending, so the document the patient receives is the
      // provider's original rather than something we re-render.
      SendByEmail: request.emailTo
        ? { EmailAddress: request.emailTo, Original: true, SendAsPaymentRequest: false }
        : null,
      // Free-text field on SUMIT's side with no uniqueness enforcement, so it
      // is a forensic trail rather than a guarantee. The real duplicate guard
      // is ours, in `tax-documents.ts`, and it runs before this call.
      ExternalReference: request.externalReference,
      Description: request.description ?? null,
    },
    Items: request.items.map((item) => ({
      Quantity: item.quantity,
      UnitPrice: item.unitPrice,
      TotalPrice: item.quantity * item.unitPrice,
      Item: { Name: item.name },
    })),
    Payments: request.payment
      ? [{ Amount: request.payment.amount, Type: PAYMENT_TYPE[request.payment.method] }]
      : [],
    // Clinic prices are what the patient is quoted and pays, VAT included.
    VATIncluded: request.vatIncluded,
    // Left null on purpose: SUMIT applies the rate in force on the document
    // date. Pinning a rate here would silently keep charging last year's VAT.
    VATRate: null,
    OriginalDocumentID: request.originalDocumentId
      ? Number(request.originalDocumentId)
      : null,
    ResponseLanguage: LANGUAGE[request.language],
  }
}

export class SumitBillingProvider implements BillingProvider {
  readonly name = "SUMIT"
  readonly live = true

  async issue(request: TaxDocumentRequest): Promise<IssueResult> {
    const problem = validateTaxDocument(request)
    if (problem) return { ok: false, message: problem, safeToRetry: true }

    const result = await sumitPost<CreateDocumentResponse>(
      "/accounting/documents/create/",
      toSumitPayload(request),
    )

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        details: result.details,
        // A business rejection means nothing was filed, so retrying the same
        // payload is safe (and pointless until it is fixed). A transport
        // failure means we do not know — the document may exist, and asking
        // again could file a second one.
        safeToRetry: result.kind === "business" || result.kind === "unconfigured",
      }
    }

    const data = result.data
    return {
      ok: true,
      document: {
        documentId: String(data.DocumentID),
        documentNumber: data.DocumentNumber,
        customerId: data.CustomerID ? String(data.CustomerID) : null,
        downloadUrl: data.DocumentDownloadURL,
        draft: request.draft,
      },
    }
  }

  /**
   * Cheapest call that proves the credentials work — and it returns something
   * worth knowing, so the Settings screen can show the VAT rate the clinic is
   * actually filing at rather than one we assumed.
   */
  async ping(): Promise<PingResult> {
    const result = await sumitPost<GetVATRateResponse>(
      "/accounting/general/getvatrate/",
      {},
    )
    if (!result.ok) return { ok: false, message: result.message }
    return { ok: true, vatRate: result.data.Rate }
  }
}
