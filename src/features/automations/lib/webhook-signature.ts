import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Proving an inbound webhook really came from the provider.
 *
 * The URL is public and the payload shape is documented, so without this
 * anyone who learns the address can post a cancellation for an appointment or
 * put words in a patient's mouth. There is no token in these requests to lean
 * on — the provider signs instead.
 *
 * The rule below is deliberately not "verify when we can":
 *
 *   - a signature header present  → it must verify, always
 *   - a secret configured, header absent → refuse
 *   - neither → accept, because this is a deploy with no provider attached and
 *     the route is being exercised by hand
 *
 * So configuring a secret is what switches enforcement on, and it cannot be
 * switched off by an attacker simply omitting the header.
 */

export type SignatureCheck =
  | { ok: true; verifiedBy: "twilio" | "meta" | "none" }
  | { ok: false; reason: string }

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // Length is not secret, and timingSafeEqual throws on a mismatch.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Twilio signs the full request URL with the form parameters appended in
 * alphabetical order, HMAC-SHA1, base64.
 *
 * It signs with the **account auth token**, not an API key secret — there is
 * no way to verify with the narrower credential, which is the one wrinkle in
 * having preferred an API key for sending. The token here is used for nothing
 * else, so a deploy can hold it for verification alone.
 */
function verifyTwilio(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): boolean {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("")
  const expected = createHmac("sha1", authToken).update(payload, "utf8").digest("base64")
  return safeEqual(expected, signature)
}

/** Meta signs the raw body bytes with the app secret, HMAC-SHA256, hex. */
function verifyMeta(rawBody: string, signature: string, appSecret: string): boolean {
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  return safeEqual(expected, signature)
}

/**
 * The URL the provider signed, which is not always the one Next.js reports.
 *
 * Behind Vercel the request arrives over HTTP with the public host in
 * `x-forwarded-*`, so `request.url` can say `http://localhost` and the
 * signature will never match. `WEBHOOK_PUBLIC_URL` is the escape hatch for
 * anything stranger — a tunnel, a proxy that rewrites the path.
 */
export function publicUrlFor(request: Request): string {
  const override = process.env.WEBHOOK_PUBLIC_URL
  const url = new URL(request.url)
  if (override) return `${override.replace(/\/$/, "")}${url.pathname}${url.search}`

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
  if (!host) return request.url
  return `${proto}://${host}${url.pathname}${url.search}`
}

export function checkWebhookSignature(input: {
  request: Request
  rawBody: string
  /** Present only for form posts, which is how Twilio sends. */
  formParams?: Record<string, string>
}): SignatureCheck {
  const twilioSignature = input.request.headers.get("x-twilio-signature")
  const metaSignature = input.request.headers.get("x-hub-signature-256")
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const metaSecret = process.env.WHATSAPP_APP_SECRET

  if (twilioSignature) {
    if (!twilioToken) return { ok: false, reason: "twilio signature present, TWILIO_AUTH_TOKEN not set" }
    const url = publicUrlFor(input.request)
    return verifyTwilio(url, input.formParams ?? {}, twilioSignature, twilioToken)
      ? { ok: true, verifiedBy: "twilio" }
      : { ok: false, reason: "twilio signature did not match" }
  }

  if (metaSignature) {
    if (!metaSecret) return { ok: false, reason: "meta signature present, WHATSAPP_APP_SECRET not set" }
    return verifyMeta(input.rawBody, metaSignature, metaSecret)
      ? { ok: true, verifiedBy: "meta" }
      : { ok: false, reason: "meta signature did not match" }
  }

  if (twilioToken || metaSecret) {
    return { ok: false, reason: "a provider secret is configured but the request carried no signature" }
  }

  return { ok: true, verifiedBy: "none" }
}
