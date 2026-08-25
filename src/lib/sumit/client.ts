import { serverEnv } from "@/lib/env"
import type { SumitResponseStatus } from "@/lib/sumit/enums"

/**
 * SUMIT REST transport. **Server-only.**
 *
 * `SUMIT_API_KEY` is full write access to the clinic's bookkeeping — it issues
 * tax documents. It is read from the environment inside route handlers and
 * never crosses to the browser, which is why there is no API-key field
 * anywhere in Settings any more.
 *
 * Every SUMIT endpoint is a POST that carries its credentials in the body
 * (there is no auth header) and answers with the same envelope, so one wrapper
 * covers all of them.
 *
 * Docs: https://app.sumit.co.il/developers/api/
 */

const SUMIT_BASE_URL = "https://api.sumit.co.il"

/** How long we wait before treating a call as lost. See `issueTaxDocument`. */
const REQUEST_TIMEOUT_MS = 20_000

export interface SumitCredentials {
  CompanyID: number
  APIKey: string
}

/** The envelope every endpoint answers with. */
interface SumitEnvelope<T> {
  Status: SumitResponseStatus
  UserErrorMessage: string | null
  TechnicalErrorDetails: string | null
  Data: T | null
}

export type SumitResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      /** Safe to show a practitioner. */
      message: string
      /** `business` = SUMIT refused on the merits; retrying the same payload will fail again. */
      kind: "business" | "technical" | "transport" | "unconfigured"
      details?: string
    }

/**
 * True once both env vars are present. When false the app runs on the
 * simulated provider — same shape as `isSupabaseConfigured()`, same intent:
 * an unconfigured deploy stays fully usable instead of erroring.
 */
export function isSumitConfigured(): boolean {
  return Boolean(serverEnv.SUMIT_COMPANY_ID && serverEnv.SUMIT_API_KEY)
}

function readCredentials(): SumitCredentials | null {
  const companyId = serverEnv.SUMIT_COMPANY_ID
  const apiKey = serverEnv.SUMIT_API_KEY
  if (!companyId || !apiKey) return null
  return { CompanyID: companyId, APIKey: apiKey }
}

/**
 * Whether this deploy is allowed to create documents that reach the tax
 * authority. Defaults to draft-only, because there is no SUMIT sandbox: the
 * account you develop against is the account you file taxes from, and
 * `IsDraft: true` is the only thing standing between a test click and a real
 * numbered invoice.
 *
 * Set `SUMIT_LIVE_DOCUMENTS=1` deliberately, once, when going live.
 */
export function sumitIssuesLiveDocuments(): boolean {
  return serverEnv.SUMIT_LIVE_DOCUMENTS === "1"
}

/**
 * POST a SUMIT operation.
 *
 * `Credentials` are injected here so no caller has to hold them, and the
 * envelope is flattened into a discriminated result so callers deal with one
 * shape rather than three (transport error / business error / success).
 */
export async function sumitPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<SumitResult<T>> {
  const credentials = readCredentials()
  if (!credentials) {
    return {
      ok: false,
      kind: "unconfigured",
      message: "SUMIT is not configured on this deploy.",
    }
  }

  let response: Response
  try {
    response = await fetch(`${SUMIT_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, Credentials: credentials }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
  } catch (error) {
    // Includes the timeout. The caller must treat this as "unknown outcome",
    // never as "did not happen" — the document may well have been created.
    return {
      ok: false,
      kind: "transport",
      message: "Could not reach SUMIT.",
      details: error instanceof Error ? error.message : String(error),
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      kind: "transport",
      message: `SUMIT returned HTTP ${response.status}.`,
      details: await response.text().catch(() => undefined),
    }
  }

  let envelope: SumitEnvelope<T>
  try {
    envelope = (await response.json()) as SumitEnvelope<T>
  } catch (error) {
    return {
      ok: false,
      kind: "transport",
      message: "SUMIT returned a response we could not read.",
      details: error instanceof Error ? error.message : String(error),
    }
  }

  if (envelope.Status !== "Success") {
    return {
      ok: false,
      kind: envelope.Status === "BusinessError" ? "business" : "technical",
      message: envelope.UserErrorMessage || "SUMIT rejected the request.",
      details: envelope.TechnicalErrorDetails ?? undefined,
    }
  }

  return { ok: true, data: envelope.Data as T }
}
