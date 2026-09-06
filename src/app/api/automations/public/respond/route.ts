import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  addResponseRow,
  findTokenRow,
  markTokenUsedRow,
} from "@/features/automations/lib/server-store"

/**
 * Where a patient's tap is written down.
 *
 * This is the one crossing that matters: the tap happens on the patient's
 * phone and has to reach the practitioner's dashboard, which is a different
 * browser on a different device. Nothing kept in local storage can do that.
 *
 * Public, and authorised only by the capability token. Which is why the body
 * is not trusted for anything identifying: the patient id, appointment and
 * invoice all come from the *stored* token, never from the request. A caller
 * can say what happened; they cannot say who it happened to.
 */

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  token: z.string().min(1),
  kind: z.enum(["confirmed", "cancelled", "rescheduled", "payment_claimed"]),
  /** Display name, carried from the token snapshot the message was built with. */
  patientName: z.string().max(200).optional(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  newStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 })
  }

  const token = await findTokenRow(parsed.data.token)
  if (!token) return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 })
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 })
  }
  if (token.singleUse && token.usedAt) {
    return NextResponse.json({ ok: false, reason: "used" }, { status: 410 })
  }

  const written = await addResponseRow({
    id: "",
    kind: parsed.data.kind,
    // From the token, not the body.
    patientId: token.patientId ?? "",
    patientName: parsed.data.patientName ?? "",
    appointmentId: token.appointmentId,
    invoiceId: token.invoiceId,
    newDate: parsed.data.newDate,
    newStart: parsed.data.newStart,
    receivedAt: new Date().toISOString(),
    // A plain confirmation needs no follow-up; everything else does. A payment
    // claim especially: it is the only thing here that no automation can close.
    handled: parsed.data.kind === "confirmed",
  })

  if (!written) {
    return NextResponse.json({ ok: false, reason: "not recorded" }, { status: 503 })
  }

  // Reminder links stay reusable — a patient may confirm and then need to move
  // the appointment — so this stamps the audit trail rather than burning it.
  await markTokenUsedRow(token.token)

  return NextResponse.json({ ok: true })
}
