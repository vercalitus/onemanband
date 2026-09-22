import { NextResponse } from "next/server"

import { findTokenRow, tokenClinicName } from "@/features/automations/lib/server-store"

/**
 * Resolve a capability link for a patient-facing page.
 *
 * Public by necessity: the patient has no account, and the token in the URL is
 * the whole authorisation. So this answers only about the token it was handed,
 * and it answers narrowly — the ids the page needs to act, and the name of the
 * clinic that sent the message, which the message itself already carried.
 * Never a patient record, never anything else about the practice. A guessed
 * token learns nothing but that it is not a link.
 *
 * The precise refusal reason is deliberate and is not a leak: "expired" and
 * "already used" are things the person holding the link needs to be told, and
 * neither helps anyone who does not hold it.
 */

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: value } = await params
  const token = await findTokenRow(value)

  if (!token) {
    return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 })
  }
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 })
  }
  if (token.singleUse && token.usedAt) {
    return NextResponse.json({ ok: false, reason: "used" }, { status: 410 })
  }

  return NextResponse.json({
    ok: true,
    // Whose clinic this is. The public pages used to take it from the
    // *patient's* browser settings, which have never been written to, so they
    // showed the demo's name — or, once that was removed, nothing at all.
    clinicName: await tokenClinicName(token.token),
    token: {
      token: token.token,
      kind: token.kind,
      patientId: token.patientId,
      appointmentId: token.appointmentId,
      invoiceId: token.invoiceId,
      expiresAt: token.expiresAt,
      singleUse: token.singleUse,
    },
  })
}
