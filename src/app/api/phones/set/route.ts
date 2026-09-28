import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { normalizeIsraeliMobile, phoneLinkGate } from "@/features/patients/lib/phone-link"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * One answer from the practitioner: this number is his, I typed it myself, or
 * I do not know it.
 *
 * The number lands on the patient record straight away. There is no staging
 * step on purpose — he is the person who knows, and a queue waiting for a
 * second opinion would only mean the work is done twice.
 *
 * A record that already carries a number is never overwritten here: the link
 * exists to fill blanks, and a blank is the only thing it may fill.
 */

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  token: z.string().min(1),
  patientId: z.string().uuid(),
  answer: z.enum(["picked", "typed", "unknown"]),
  phone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 })

  const gate = phoneLinkGate(parsed.data.token)
  if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.reason }, { status: 403 })

  const db = createSupabaseAdminClient()
  if (!db) return NextResponse.json({ ok: false, reason: "no store" }, { status: 503 })

  const { patientId, answer } = parsed.data
  const { data: patient } = await db
    .from("patients")
    .select("id, clinic_id, phone")
    .eq("id", patientId)
    .maybeSingle()
  if (!patient) return NextResponse.json({ ok: false, reason: "unknown patient" }, { status: 404 })

  // Only the patients this link was built for, so a guessed id leads nowhere.
  const { data: asked } = await db
    .from("phone_requests")
    .select("patient_id")
    .eq("patient_id", patientId)
    .maybeSingle()
  if (!asked) return NextResponse.json({ ok: false, reason: "not on this list" }, { status: 404 })

  let saved: string | null = null
  if (answer !== "unknown") {
    const phone = normalizeIsraeliMobile(parsed.data.phone ?? "")
    if (!phone) return NextResponse.json({ ok: false, reason: "not an israeli mobile" }, { status: 400 })
    if (!(patient.phone ?? "").trim()) {
      const { error } = await db.from("patients").update({ phone }).eq("id", patientId)
      if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
    }
    saved = phone
    await db
      .from("phone_candidates")
      .update({ chosen_at: new Date().toISOString() })
      .eq("patient_id", patientId)
      .eq("phone", phone)
  }

  await db
    .from("phone_requests")
    .update({ answered_at: new Date().toISOString(), answer })
    .eq("patient_id", patientId)

  return NextResponse.json({ ok: true, saved })
}
