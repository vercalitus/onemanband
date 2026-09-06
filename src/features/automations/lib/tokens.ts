import { findToken, randomId, saveToken } from "@/features/automations/lib/automation-store"
import type { AccessToken, AccessTokenKind } from "@/types/automation"

/**
 * Capability links for patient-facing pages.
 *
 * There is no patient login anywhere in this product, so the token in the URL
 * *is* the authorisation. That puts three requirements on it, all enforced
 * here: it must be unguessable, it must expire, and the one-shot kinds must
 * burn after use.
 *
 * Mock mode mints these with `crypto.randomUUID`. When Supabase goes live the
 * row moves to `automation_access_tokens` and only `mintToken`/`resolveToken`
 * change — callers keep the same shape.
 */

const DAY_MS = 86_400_000

/** How long each kind of link stays usable. */
const TTL_DAYS: Record<AccessTokenKind, number> = {
  // Registration invites are handed out ahead of time and may sit unopened.
  book: 30,
  // Reminder buttons are only meaningful around the appointment itself.
  respond: 14,
  questionnaire: 21,
  invoice: 90,
}

/** Reminder buttons get clicked more than once (confirm, then reschedule). */
const SINGLE_USE: Record<AccessTokenKind, boolean> = {
  book: false,
  respond: false,
  questionnaire: true,
  invoice: false,
}

export function mintToken(
  kind: AccessTokenKind,
  refs: Pick<
    AccessToken,
    "patientId" | "appointmentId" | "invoiceId" | "questionnaireId" | "context"
  >,
): AccessToken {
  const now = new Date()
  const token: AccessToken = {
    token: randomId(kind),
    kind,
    ...refs,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_DAYS[kind] * DAY_MS).toISOString(),
    singleUse: SINGLE_USE[kind],
  }
  saveToken(token)
  mirrorToken(token)
  return token
}

/**
 * Copy a minted link to the database.
 *
 * A link that exists only in the practitioner's browser cannot be opened on a
 * patient's phone, which is the whole purpose of minting one. Fire and forget
 * on purpose: the local copy is already saved, so a deploy with no database —
 * or a failed request — degrades to exactly the behaviour this had before,
 * rather than blocking the message from being planned at all.
 */
function mirrorToken(token: AccessToken): void {
  if (typeof window === "undefined") return
  void fetch("/api/automations/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(token),
  }).catch(() => {})
}

export type TokenResolution =
  | { ok: true; token: AccessToken }
  | { ok: false; reason: "unknown" | "expired" | "used" }

/** Look a token up and state precisely why it is unusable, if it is. */
export function resolveToken(value: string, kind?: AccessTokenKind): TokenResolution {
  const token = findToken(value)
  if (!token || (kind && token.kind !== kind)) return { ok: false, reason: "unknown" }
  if (new Date(token.expiresAt).getTime() < Date.now()) return { ok: false, reason: "expired" }
  if (token.singleUse && token.usedAt) return { ok: false, reason: "used" }
  return { ok: true, token }
}

/** Public route each token kind lands on. */
const ROUTE: Record<AccessTokenKind, string> = {
  book: "/book",
  respond: "/r",
  questionnaire: "/q",
  invoice: "/r",
}

/**
 * Absolute link for a token. Falls back to a relative path when no origin is
 * known (server render without a request URL) — still correct in the app, and
 * the real base URL arrives with the messaging provider config.
 */
export function tokenLink(token: AccessToken, origin?: string): string {
  const path = `${ROUTE[token.kind]}/${token.token}`
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "")
  return base ? `${base}${path}` : path
}
