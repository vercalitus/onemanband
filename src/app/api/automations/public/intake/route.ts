import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { addIntakeRow, markTokenUsedRow } from "@/features/automations/lib/server-store"

/**
 * A patient's self-registration, arriving from `/book/<token>`.
 *
 * Public by necessity — the patient has no account and the token in the link
 * is the whole authorisation. The token is checked again here, server-side,
 * because the page that collected the form cannot be trusted to have done so.
 *
 * This is the crossing that was missing: the form used to be saved into the
 * patient's own browser, where the clinic could never see it.
 */

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().max(200).optional().default(""),
  dateOfBirth: z.string().max(10).optional(),
  reason: z.string().max(2000).optional().default(""),
  documentNames: z.array(z.string().max(300)).max(20).optional().default([]),
  requestedType: z.string().max(20),
  requestedDate: z.string().max(10).optional(),
  requestedStart: z.string().max(5).optional(),
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

  const now = new Date().toISOString()
  const written = await addIntakeRow({
    id: "",
    ...parsed.data,
    status: "submitted",
    createdAt: now,
    submittedAt: now,
  })

  if (!written.ok) {
    // "no store" is answered 200 so the demo page can keep its local path; a
    // refused token is the patient's problem to be told about, and a failed
    // insert is ours.
    const status = written.reason === "no store" ? 200 : /token|expired|used/.test(written.reason) ? 410 : 500
    return NextResponse.json({ ok: false, reason: written.reason }, { status })
  }

  // A booking link is for one registration. Marked after the row exists, so a
  // failed insert leaves the link usable for another try.
  await markTokenUsedRow(parsed.data.token)
  return NextResponse.json({ ok: true, id: written.id })
}
