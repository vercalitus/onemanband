import { NextResponse, type NextRequest } from "next/server"

import { recordPatientResponse } from "@/features/automations/lib/events"
import { resolveToken } from "@/features/automations/lib/tokens"
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
    body?.buttonId

  if (typeof raw !== "string" || !raw.includes(":")) return null
  const [action, token] = raw.split(":")
  if (!action || !token) return null
  return { action: action as AutomationAction, token }
}

export async function POST(request: NextRequest) {
  // TODO(provider): verify the X-Hub-Signature-256 HMAC against the app secret
  // before trusting anything in the body. Left open while no provider signs it.
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const tap = parseButtonTap(payload)
  // Meta retries anything that isn't a 2xx, so unrecognised events are
  // acknowledged rather than rejected — otherwise one odd payload loops.
  if (!tap) return NextResponse.json({ ok: true, ignored: true })

  const resolution = resolveToken(tap.token)
  if (!resolution.ok) {
    return NextResponse.json({ ok: true, ignored: true, reason: resolution.reason })
  }

  const kind = ACTION_TO_RESPONSE[tap.action]
  if (!kind) return NextResponse.json({ ok: true, ignored: true, reason: "no state change" })

  const { token } = resolution
  recordPatientResponse({
    kind,
    patientId: token.patientId ?? "",
    // The clinic app resolves the display name from patientId; the webhook has
    // no patient directory of its own.
    patientName: "",
    appointmentId: token.appointmentId,
  })

  return NextResponse.json({ ok: true, action: tap.action })
}
