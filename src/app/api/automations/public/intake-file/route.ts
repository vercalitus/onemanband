import { NextResponse, type NextRequest } from "next/server"

import { findTokenRow } from "@/features/automations/lib/server-store"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * A file a patient attaches while registering — an X-ray, a referral, an
 * insurance form.
 *
 * Public by necessity and gated by the booking token, like the registration
 * itself. The file goes into the clinic's private bucket under an `intakes/`
 * folder keyed by the token, where nothing but the review step reads it; on
 * approval it moves into the patient's own folder and becomes a document row.
 * Until then it is what the intake is: unverified material a clinician has
 * not yet accepted.
 *
 * The page used to keep file *names* and transmit nothing, so a patient who
 * attached three scans had, as far as the clinic could ever tell, attached
 * three strings.
 */

export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  const db = createSupabaseAdminClient()
  // Answered 200 so the demo page keeps its names-only path.
  if (!db) return NextResponse.json({ ok: false, reason: "no store" })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid form" }, { status: 400 })
  }

  const tokenValue = form.get("token")
  const file = form.get("file")
  if (typeof tokenValue !== "string" || !tokenValue || !(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: "invalid form" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "too large" }, { status: 413 })
  }
  if (!/^(image\/|application\/pdf$)/.test(file.type)) {
    return NextResponse.json({ ok: false, reason: "unsupported type" }, { status: 415 })
  }

  const token = await findTokenRow(tokenValue)
  if (!token || token.kind !== "book") {
    return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 })
  }
  if (new Date(token.expiresAt).getTime() < Date.now() || (token.singleUse && token.usedAt)) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 })
  }

  const { data: tokenRow } = await db
    .from("automation_access_tokens")
    .select("clinic_id")
    .eq("token", tokenValue)
    .maybeSingle()
  if (!tokenRow) return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 })

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const safe = file.name.replace(/[^\w.\-]+/g, "_")
  const path = `${tokenRow.clinic_id}/intakes/${tokenValue}/${stamp}-${safe}`

  const { error } = await db.storage
    .from("patient-media")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type })
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, path, name: file.name })
}
