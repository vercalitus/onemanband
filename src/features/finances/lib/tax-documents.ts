import type { TaxDocumentRequest } from "@/features/finances/lib/plan-tax-document"
import type { TaxDocumentLink } from "@/types/domain"

/**
 * The duplicate guard, and the record of what was filed.
 *
 * A tax invoice cannot be deleted. Filing one twice for a single visit costs a
 * credit note and muddies a VAT return, so this is the one place in the app
 * where "try again" is not automatically safe.
 *
 * The guard is ours rather than the provider's on purpose: SUMIT's
 * `ExternalReference` is a free-text field with no uniqueness enforcement, so
 * it is a forensic trail, not a lock. The lock is here, and it is written
 * *before* the network call — a crash mid-flight leaves evidence rather than
 * silence.
 *
 * Mock-mode note: this lives in localStorage next to `billing.invoices.v1`.
 * Supabase replaces the two readers/writers below and nothing else changes.
 */

const STORAGE_KEY = "billing.taxdocs.v1"

/** Fired after a filing lands, so an open Finances page can re-read. */
export const TAX_DOCUMENT_EVENT = "tax-document-changed"

export type FilingState =
  | "in_flight"
  /** A document exists at the provider. */
  | "filed"
  /**
   * The provider refused on the merits and filed nothing. Retrying after
   * fixing the cause is safe.
   */
  | "failed"
  /**
   * We do not know. A timeout or a dropped connection — the document may well
   * exist. Retrying could file a second one, so this state blocks retries and
   * asks for a human to look.
   */
  | "unknown"

export interface FilingRecord {
  /** Idempotency key — the appointment this bills. */
  reference: string
  invoiceId: string
  state: FilingState
  startedAt: string
  document?: TaxDocumentLink
  error?: string
}

function readAll(): FilingRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FilingRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records: FilingRecord[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    window.dispatchEvent(new Event(TAX_DOCUMENT_EVENT))
  } catch {
    /* quota / private mode */
  }
}

function upsert(record: FilingRecord): void {
  const rest = readAll().filter((r) => r.reference !== record.reference)
  writeAll([record, ...rest])
}

export function findFiling(reference: string): FilingRecord | null {
  return readAll().find((r) => r.reference === reference) ?? null
}

/** Every filing that needs a human to check the provider before anything else happens. */
export function unresolvedFilings(): FilingRecord[] {
  return readAll().filter((r) => r.state === "unknown" || r.state === "in_flight")
}

/**
 * Clear a stuck filing after checking the provider by hand.
 *
 * `filedElsewhere` records the document the practitioner found, so the invoice
 * links to the real thing. Omitting it declares that no document exists and
 * re-opens the invoice for filing.
 */
export function resolveFiling(
  reference: string,
  filedElsewhere?: TaxDocumentLink,
): void {
  const existing = findFiling(reference)
  if (!existing) return
  upsert(
    filedElsewhere
      ? { ...existing, state: "filed", document: filedElsewhere, error: undefined }
      : { ...existing, state: "failed", error: "resolved by hand: no document found" },
  )
}

export type FileDocumentOutcome =
  | { status: "filed"; document: TaxDocumentLink; alreadyExisted: boolean; provider: string }
  | { status: "failed"; message: string }
  | { status: "blocked"; message: string; record: FilingRecord }

interface IssueApiResponse {
  ok: boolean
  provider?: string
  live?: boolean
  message?: string
  details?: string
  safeToRetry?: boolean
  document?: {
    documentId: string
    documentNumber: number | null
    customerId: string | null
    downloadUrl: string | null
    draft: boolean
  }
}

/**
 * File a document, once.
 *
 * Ordering matters and is the whole point: check the ledger, write the
 * in-flight marker, call the server, then record the terminal state. Anything
 * that interrupts the call leaves an `in_flight` or `unknown` row to reconcile
 * rather than a silently missing document.
 */
export async function fileTaxDocument(
  request: TaxDocumentRequest,
  context: { invoiceId: string },
): Promise<FileDocumentOutcome> {
  const existing = findFiling(request.externalReference)

  if (existing?.state === "filed" && existing.document) {
    return {
      status: "filed",
      document: existing.document,
      alreadyExisted: true,
      provider: existing.document.provider,
    }
  }
  if (existing && (existing.state === "in_flight" || existing.state === "unknown")) {
    return {
      status: "blocked",
      record: existing,
      message:
        "A filing for this visit was started and its outcome is unknown. Check the bookkeeping system before issuing again.",
    }
  }

  const startedAt = new Date().toISOString()
  upsert({
    reference: request.externalReference,
    invoiceId: context.invoiceId,
    state: "in_flight",
    startedAt,
  })

  let response: IssueApiResponse
  try {
    const res = await fetch("/api/billing/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    response = (await res.json()) as IssueApiResponse
  } catch (error) {
    // The request left this machine and we never heard back. Unknown, not failed.
    const record: FilingRecord = {
      reference: request.externalReference,
      invoiceId: context.invoiceId,
      state: "unknown",
      startedAt,
      error: error instanceof Error ? error.message : String(error),
    }
    upsert(record)
    return {
      status: "blocked",
      message: "Lost contact while filing. Check the bookkeeping system before retrying.",
      record,
    }
  }

  if (!response.ok || !response.document) {
    const message = response.message ?? "Filing failed."
    const record: FilingRecord = {
      reference: request.externalReference,
      invoiceId: context.invoiceId,
      state: response.safeToRetry ? "failed" : "unknown",
      startedAt,
      error: message,
    }
    upsert(record)
    return response.safeToRetry
      ? { status: "failed", message }
      : { status: "blocked", message, record }
  }

  const document: TaxDocumentLink = {
    provider: (response.provider as TaxDocumentLink["provider"]) ?? "simulated",
    documentId: response.document.documentId,
    documentNumber: response.document.documentNumber,
    customerId: response.document.customerId,
    downloadUrl: response.document.downloadUrl,
    issuedAt: new Date().toISOString(),
    draft: response.document.draft,
  }

  upsert({
    reference: request.externalReference,
    invoiceId: context.invoiceId,
    state: "filed",
    startedAt,
    document,
  })

  return {
    status: "filed",
    document,
    alreadyExisted: false,
    provider: response.provider ?? "simulated",
  }
}
