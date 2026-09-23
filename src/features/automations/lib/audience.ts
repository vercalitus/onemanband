import { serverEnv } from "@/lib/env"

/**
 * Who this deploy is allowed to message.
 *
 * A clinic with 1,181 patient records and a live provider is one cron tick away
 * from writing to all of them. Nothing about the engine knows whether it has
 * been proven yet, and "we will be careful" is not a mechanism — so the gate
 * is here, on the server, in front of every provider call.
 *
 * It is deliberately **closed by default**. An empty `MESSAGING_ALLOWLIST`
 * blocks everybody rather than allowing everybody, because the failure that
 * matters is the one where somebody forgets to set a variable and a thousand
 * people get a message. Opening it to the whole clinic is a separate,
 * deliberate act: `MESSAGING_AUDIENCE=all`.
 *
 * A blocked message is **not** a delivered one and not a quiet drop: the outbox
 * row fails with the reason below, which is the same rule the rest of the
 * dispatcher follows — a reminder that was never sent must never look sent.
 */

/** Israeli mobile in E.164, however it happened to be typed. */
export function normalizeRecipient(value: string): string {
  const trimmed = value.trim().toLowerCase()
  // An email address is compared as written; only numbers get rewritten.
  if (trimmed.includes("@")) return trimmed

  const digits = trimmed.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  if (digits.startsWith("972")) return `+${digits}`
  // 05x… → +9725x…
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`
  return digits ? `+${digits}` : ""
}

function allowlist(): string[] {
  return (serverEnv.MESSAGING_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => normalizeRecipient(entry))
    .filter(Boolean)
}

export type AudienceCheck = { ok: true } | { ok: false; reason: string }

export function audienceAllows(to: string): AudienceCheck {
  if (serverEnv.MESSAGING_AUDIENCE === "all") return { ok: true }

  const allowed = allowlist()
  if (!allowed.length) {
    return {
      ok: false,
      reason: "blocked: no MESSAGING_ALLOWLIST set (and MESSAGING_AUDIENCE is not 'all')",
    }
  }

  const recipient = normalizeRecipient(to)
  if (allowed.includes(recipient)) return { ok: true }
  return { ok: false, reason: `blocked: ${recipient || to} is not on MESSAGING_ALLOWLIST` }
}

/** For the outbox board and the ping: what this deploy would do right now. */
export function audienceDescription(): string {
  if (serverEnv.MESSAGING_AUDIENCE === "all") return "everyone"
  const allowed = allowlist()
  return allowed.length ? `${allowed.length} allowlisted recipient(s)` : "nobody"
}
