import "server-only"

/**
 * The link that lets the practitioner fill in missing phone numbers.
 *
 * It is a page with no login, so the secret in the URL is the whole
 * authorisation — the same bargain the patient-facing pages make. Two things
 * keep that honest: the token is compared in constant time, and the link has a
 * date after which it simply stops working, set beside it in the environment.
 * Revoking early is deleting one variable.
 */

export type PhoneLinkGate = { ok: true } | { ok: false; reason: string }

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function phoneLinkGate(token: string | null | undefined): PhoneLinkGate {
  const expected = process.env.PHONE_FILL_TOKEN
  if (!expected) return { ok: false, reason: "link is closed" }
  if (!token || !sameSecret(token, expected)) return { ok: false, reason: "unknown link" }

  const until = process.env.PHONE_FILL_EXPIRES
  if (until) {
    const deadline = new Date(`${until}T23:59:59Z`).getTime()
    if (Number.isFinite(deadline) && Date.now() > deadline) return { ok: false, reason: "expired" }
  }
  return { ok: true }
}

/** 05x, however it was typed. Returns null when it is not an Israeli mobile. */
export function normalizeIsraeliMobile(value: string): string | null {
  const digits = (value || "").replace(/[^\d+]/g, "")
  const local = digits.startsWith("+972")
    ? `0${digits.slice(4)}`
    : digits.startsWith("972")
      ? `0${digits.slice(3)}`
      : digits.startsWith("00972")
        ? `0${digits.slice(5)}`
        : digits
  return /^05\d{8}$/.test(local) ? local : null
}
