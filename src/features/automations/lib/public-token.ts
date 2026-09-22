"use client"

import { resolveToken } from "@/features/automations/lib/tokens"
import type { AccessToken, AccessTokenKind } from "@/types/automation"

/**
 * Resolve a patient's link, wherever the token happens to live.
 *
 * Tokens are minted in the practitioner's browser and written to Postgres when
 * the message is queued. The patient opens the link on their own phone, where
 * the browser store is empty — so a page that only looks locally tells every
 * patient their link is invalid. The reminder page had learned this and asked
 * the server as well; registration and the questionnaire had not, and could
 * never have worked for anybody outside the clinic's own browser.
 *
 * Local first, because the practitioner opening their own link should not need
 * the round trip, then the public endpoint. A network failure is "unreachable"
 * rather than "invalid": telling somebody their link is dead when the request
 * merely failed sends them to the clinic for nothing.
 */
export type PublicTokenResult =
  /** `clinicName` comes from the server — the patient's browser has no idea. */
  | { ok: true; token: AccessToken; clinicName?: string | null }
  | { ok: false; reason: string }

export async function resolvePublicToken(
  value: string,
  kind?: AccessTokenKind,
): Promise<PublicTokenResult> {
  const local = resolveToken(value, kind)
  if (local.ok) return { ok: true, token: local.token }

  try {
    const res = await fetch(`/api/automations/public/token/${encodeURIComponent(value)}`, {
      cache: "no-store",
    })
    const body = (await res.json()) as
      | { ok: true; token: AccessToken; clinicName?: string | null }
      | { ok: false; reason: string }
    if (!body.ok) return body
    if (kind && body.token.kind !== kind) return { ok: false, reason: "unknown" }
    return { ok: true, token: body.token, clinicName: body.clinicName ?? null }
  } catch {
    return { ok: false, reason: "unreachable" }
  }
}
