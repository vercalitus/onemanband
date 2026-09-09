import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  listSubmittedIntakeRows,
  markIntakeApprovedRow,
} from "@/features/automations/lib/server-store"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Self-registrations waiting on the clinic.
 *
 * Session-gated by the middleware. The return leg of `/book/<token>`: the
 * patient wrote it on their phone, this is where the practitioner's dashboard
 * picks it up.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, intakes: await listSubmittedIntakeRows() })
}

const approveSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1).optional(),
})

/** The intake was turned into a patient record. */
export async function PATCH(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = approveSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 })
  }

  const session = await createSupabaseServerClient()
  const { data } = session ? await session.auth.getUser() : { data: { user: null } }

  const ok = await markIntakeApprovedRow(parsed.data.id, {
    patientId: parsed.data.patientId,
    approvedBy: data.user?.id,
  })
  return NextResponse.json({ ok })
}
