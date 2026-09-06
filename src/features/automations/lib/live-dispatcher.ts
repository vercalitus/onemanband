import "server-only"

import { serverEnv } from "@/lib/env"
import {
  SimulatedDispatcher,
  type DispatchResult,
  type MessageDispatcher,
} from "@/features/automations/lib/dispatcher"
import type { MessageChannel, OutboxMessage } from "@/types/automation"

/**
 * The real delivery lanes. **Server-only, and the `server-only` import above
 * makes that a build error rather than a code review.**
 *
 * These credentials send mail and bill messages in the clinic's name, so the
 * one thing that must never happen is this module ending up in a browser
 * bundle. `dispatcher.ts` stays client-safe for the Settings queue card; only
 * the cron route reaches this file.
 *
 * Both providers are plain REST over `fetch` rather than their SDKs. Two
 * dependencies for two POST requests is a poor trade, and the SDKs would want
 * to live in the same bundle we are trying to keep them out of.
 */

/** How long to wait before treating a send as lost. */
const TIMEOUT_MS = 15_000

/* -------------------------------------------------------------------------- */
/* Twilio — WhatsApp and SMS                                                   */
/* -------------------------------------------------------------------------- */

function twilioConfigured(): boolean {
  return Boolean(
    serverEnv.TWILIO_ACCOUNT_SID &&
      serverEnv.TWILIO_API_KEY_SID &&
      serverEnv.TWILIO_API_KEY_SECRET,
  )
}

/**
 * Twilio's Messages endpoint is form-encoded, not JSON, and authenticates with
 * HTTP Basic. The API key pair is the username/password; the account SID stays
 * in the path because the key belongs to the account rather than replacing it.
 */
async function twilioSend(
  from: string,
  to: string,
  body: string,
): Promise<DispatchResult> {
  const accountSid = serverEnv.TWILIO_ACCOUNT_SID as string
  const auth = Buffer.from(
    `${serverEnv.TWILIO_API_KEY_SID}:${serverEnv.TWILIO_API_KEY_SECRET}`,
  ).toString("base64")

  let response: Response
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: to, Body: body }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    )
  } catch (error) {
    return {
      ok: false,
      error: `twilio unreachable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | { sid?: string; message?: string; code?: number }
    | null

  if (!response.ok) {
    // Twilio's own message is the useful half — it names the actual problem
    // (unverified sandbox recipient, bad number, no template) far better than
    // the status code does.
    return {
      ok: false,
      error: `twilio ${payload?.code ?? response.status}: ${payload?.message ?? "send failed"}`,
    }
  }

  return { ok: true, providerMessageId: payload?.sid }
}

/* -------------------------------------------------------------------------- */
/* Resend — email                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Resend refuses to send from an unverified domain, so until the clinic's
 * domain is verified the only sender that works is theirs — and it only
 * delivers to the account owner. That is the correct behaviour for a deploy
 * that has not proved it owns a domain, so it is left as the default rather
 * than worked around.
 */
const RESEND_FALLBACK_FROM = "OneManBand <onboarding@resend.dev>"

async function resendSend(message: OutboxMessage): Promise<DispatchResult> {
  let response: Response
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv.RESEND_FROM || RESEND_FALLBACK_FROM,
        to: [message.to],
        subject: message.subject || "",
        text: message.body,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
  } catch (error) {
    return {
      ok: false,
      error: `resend unreachable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null

  if (!response.ok) {
    return {
      ok: false,
      error: `resend ${response.status}: ${payload?.message ?? payload?.name ?? "send failed"}`,
    }
  }

  return { ok: true, providerMessageId: payload?.id }
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One dispatcher per channel, chosen by what is actually configured.
 *
 * A channel with no provider is a *failure*, never a silent success and never
 * a quiet drop: the outbox row says "no provider for whatsapp" and stays
 * visible in the queue. A reminder that was never sent must not look sent.
 */
class LiveDispatcher implements MessageDispatcher {
  readonly name: string
  readonly channels: MessageChannel[]

  constructor(private readonly lanes: Partial<Record<MessageChannel, true>>) {
    this.channels = Object.keys(lanes) as MessageChannel[]
    this.name = this.channels.length ? `live(${this.channels.join("+")})` : "live"
  }

  async send(message: OutboxMessage): Promise<DispatchResult> {
    if (!this.lanes[message.channel]) {
      return { ok: false, error: `no provider configured for ${message.channel}` }
    }

    if (message.channel === "email") return resendSend(message)

    const from =
      message.channel === "whatsapp"
        ? serverEnv.TWILIO_WHATSAPP_FROM
        : serverEnv.TWILIO_SMS_FROM
    if (!from) return { ok: false, error: `no sender configured for ${message.channel}` }

    // WhatsApp addresses carry the scheme on both ends; SMS carries none.
    const to = message.channel === "whatsapp" ? `whatsapp:${message.to}` : message.to
    return twilioSend(from, to, message.body)
  }
}

/**
 * What this deploy can actually deliver with.
 *
 * With nothing configured it returns the simulator, matching how the rest of
 * the app treats absent credentials: an unconfigured deploy stays usable and
 * says plainly that it is simulating, rather than erroring or pretending.
 */
export function resolveServerDispatcher(): MessageDispatcher {
  const lanes: Partial<Record<MessageChannel, true>> = {}
  if (twilioConfigured() && serverEnv.TWILIO_WHATSAPP_FROM) lanes.whatsapp = true
  if (twilioConfigured() && serverEnv.TWILIO_SMS_FROM) lanes.sms = true
  if (serverEnv.RESEND_API_KEY) lanes.email = true

  if (!Object.keys(lanes).length) return new SimulatedDispatcher()
  return new LiveDispatcher(lanes)
}
