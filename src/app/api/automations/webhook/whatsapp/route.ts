import { NextResponse, type NextRequest } from "next/server"

import {
  addInboundMessageRow,
  addResponseRow,
  findTokenRow,
  markTokenUsedRow,
  patientForRecipient,
} from "@/features/automations/lib/server-store"
import { checkWebhookSignature } from "@/features/automations/lib/webhook-signature"
import type { AutomationAction, PatientResponseKind } from "@/types/automation"

/**
 * Inbound WhatsApp webhook — where button taps arrive.
 *
 * Interactive buttons are not a normal reply: Meta delivers the tap as a
 * separate inbound event carrying the button's `id`, which is why the outbox
 * stores a `token` alongside each message's `actions`. We encode the button id
 * as `<action>:<token>` so a tap is self-describing and needs no lookup table.
 *
 * Two things are stubbed until the provider is chosen, and both are marked
 * below: signature verification and the exact payload path. Everything after
 * parsing — token resolution, state change, dashboard task — is real.
 */

export const dynamic = "force-dynamic"

/** Meta's webhook handshake: echo `hub.challenge` when the verify token matches. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")
  const expected = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 })
}

const ACTION_TO_RESPONSE: Partial<Record<AutomationAction, PatientResponseKind>> = {
  confirm: "confirmed",
  cancel: "cancelled",
  reschedule: "rescheduled",
}

interface ButtonTap {
  action: AutomationAction
  token: string
}

/** An inbound message that is words rather than a button. */
interface InboundText {
  from: string
  body: string
}

/**
 * Pull a free-text message out of whichever provider sent it.
 *
 * This is the half that used to be missing, and its absence was the serious
 * one: the clinic tells patients to write if something hurts, and anything
 * that was not a button tap was acknowledged with a 200 and dropped. Nobody
 * saw it.
 *
 * Two shapes because two providers: Twilio posts a flat form body, Meta posts
 * a nested JSON envelope.
 */
function parseInboundText(payload: unknown): InboundText | null {
  const body = payload as {
    // Twilio: application/x-www-form-urlencoded, already turned into an object.
    From?: string
    Body?: string
    // Meta Cloud API.
    entry?: {
      changes?: {
        value?: { messages?: { from?: string; type?: string; text?: { body?: string } }[] }
      }[]
    }[]
  }

  if (typeof body?.Body === "string" && body.Body.trim() && typeof body.From === "string") {
    return { from: body.From, body: body.Body.trim() }
  }

  const meta = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (meta?.type === "text" && meta.text?.body?.trim() && meta.from) {
    return { from: meta.from, body: meta.text.body.trim() }
  }
  return null
}

/**
 * Pull `<action>:<token>` out of a Meta Cloud API payload.
 *
 * TODO(provider): the exact path differs per provider (Meta Cloud API vs
 * Twilio vs 360dialog). Only this function needs rewriting for another one.
 */
function parseButtonTap(payload: unknown): ButtonTap | null {
  const body = payload as {
    entry?: { changes?: { value?: { messages?: { interactive?: { button_reply?: { id?: string } } }[] } }[] }[]
    // Flat shape accepted so the route can be exercised with a simple curl.
    buttonId?: string
  }

  const raw =
    body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.id ??
    // Twilio delivers a template button tap as ButtonPayload on the form body.
    (payload as { ButtonPayload?: string })?.ButtonPayload ??
    body?.buttonId

  if (typeof raw !== "string" || !raw.includes(":")) return null
  const [action, token] = raw.split(":")
  if (!action || !token) return null
  return { action: action as AutomationAction, token }
}

/**
 * Providers disagree about encoding: Meta posts JSON, Twilio posts a form.
 *
 * The body is read once as text and parsed from there, because both signature
 * schemes need the bytes exactly as they arrived — reading it twice is not
 * possible, and re-serialising a parsed object would not reproduce them.
 */
function parsePayload(
  raw: string,
  contentType: string,
): { payload: unknown; formParams?: Record<string, string> } | null {
  try {
    if (contentType.includes("form")) {
      const params = Object.fromEntries(new URLSearchParams(raw).entries())
      return { payload: params, formParams: params }
    }
    return { payload: JSON.parse(raw) }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const parsed = parsePayload(rawBody, request.headers.get("content-type") ?? "")
  if (!parsed) return NextResponse.json({ error: "unreadable body" }, { status: 400 })

  // Before anything in the body is believed. This URL is public and the
  // payload shape is documented, so without this anyone who finds the address
  // can cancel a stranger's appointment or invent a message from them.
  const signature = checkWebhookSignature({
    request,
    rawBody,
    formParams: parsed.formParams,
  })
  if (!signature.ok) {
    // The reason stays in the log. An unverified caller learns only that it
    // was refused, not how the gate is configured.
    console.error(`[automations/webhook] refused: ${signature.reason}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 403 })
  }

  const payload = parsed.payload

  // Words first. A button tap is a fact the system can act on; a message is a
  // person talking, and dropping it is the failure this route used to have.
  const text = parseInboundText(payload)
  if (text) {
    const match = await patientForRecipient(text.from)
    await addInboundMessageRow({
      fromAddress: text.from,
      body: text.body,
      patientId: match?.patientId,
    })
    return NextResponse.json({ ok: true, recorded: "message" })
  }

  const tap = parseButtonTap(payload)
  // Providers retry anything that isn't a 2xx, so unrecognised events are
  // acknowledged rather than rejected — otherwise one odd payload loops.
  if (!tap) return NextResponse.json({ ok: true, ignored: true })

  // From the database, not the local store: this is the server, and the store
  // that mints tokens lives in the practitioner's browser.
  const token = await findTokenRow(tap.token)
  if (!token) return NextResponse.json({ ok: true, ignored: true, reason: "unknown" })
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: true, ignored: true, reason: "expired" })
  }

  const kind = ACTION_TO_RESPONSE[tap.action]
  if (!kind) return NextResponse.json({ ok: true, ignored: true, reason: "no state change" })

  await addResponseRow({
    id: "",
    kind,
    patientId: token.patientId ?? "",
    // The clinic app resolves the display name from patientId; the webhook has
    // no patient directory of its own.
    patientName: "",
    appointmentId: token.appointmentId,
    invoiceId: token.invoiceId,
    receivedAt: new Date().toISOString(),
    handled: kind === "confirmed",
  })
  await markTokenUsedRow(token.token)

  return NextResponse.json({ ok: true, action: tap.action })
}
