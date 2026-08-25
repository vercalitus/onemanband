import {
  validateTaxDocument,
  type TaxDocumentRequest,
} from "@/features/finances/lib/plan-tax-document"

/**
 * Filing boundary.
 *
 * This is the one seam that changes when a real bookkeeping provider is
 * wired. Everything upstream — what document should exist, what it says, when
 * it may be filed — is provider-agnostic and lives in `plan-tax-document.ts`.
 *
 * `SimulatedBillingProvider` is the only implementation that runs without
 * credentials. It does not pretend to succeed: it validates the document as
 * strictly as SUMIT would, then reports `simulated`, with no document number,
 * because no legal document exists. Same contract as the automation
 * dispatcher's `simulated` state.
 */

export interface IssuedTaxDocument {
  /** Provider-side id. Needed later for credit notes and PDF fetches. */
  documentId: string
  /** The legal document number. Null for drafts and for simulated filings. */
  documentNumber: number | null
  customerId: string | null
  downloadUrl: string | null
  draft: boolean
}

export type IssueResult =
  | { ok: true; document: IssuedTaxDocument }
  | {
      ok: false
      message: string
      /**
       * False when the outcome is genuinely unknown — a timeout, a dropped
       * connection. The document may exist. Callers must reconcile rather
       * than blindly re-file, or the clinic ends up with two tax invoices for
       * one visit and a credit note to write.
       */
      safeToRetry: boolean
      details?: string
    }

export interface PingResult {
  ok: boolean
  /** VAT rate as a fraction (0.18 = 18%), read from the provider, never assumed. */
  vatRate?: number
  message?: string
}

export interface BillingProvider {
  /** Shown in the UI: "SUMIT", or "simulated" when nothing is wired. */
  readonly name: string
  /** True when filings reach a real bookkeeping system. */
  readonly live: boolean
  issue(request: TaxDocumentRequest): Promise<IssueResult>
  ping(): Promise<PingResult>
}

/**
 * Stable pseudo-id for a simulated filing.
 *
 * Deliberately derived from the idempotency reference rather than random:
 * filing the same visit twice in simulation returns the same id, which is
 * exactly the behaviour the real idempotency guard has to produce. A random
 * id would hide a broken guard until the day it costs a credit note.
 */
function simulatedDocumentId(reference: string): string {
  let hash = 0
  for (let i = 0; i < reference.length; i += 1) {
    hash = (hash * 31 + reference.charCodeAt(i)) | 0
  }
  return `sim_${Math.abs(hash).toString(36)}`
}

export class SimulatedBillingProvider implements BillingProvider {
  readonly name = "simulated"
  readonly live = false

  async issue(request: TaxDocumentRequest): Promise<IssueResult> {
    const problem = validateTaxDocument(request)
    if (problem) return { ok: false, message: problem, safeToRetry: true }
    return {
      ok: true,
      document: {
        documentId: simulatedDocumentId(request.externalReference),
        // No provider filed anything, so there is no legal number to report.
        documentNumber: null,
        customerId: null,
        downloadUrl: null,
        draft: true,
      },
    }
  }

  async ping(): Promise<PingResult> {
    return { ok: true, message: "simulated" }
  }
}
