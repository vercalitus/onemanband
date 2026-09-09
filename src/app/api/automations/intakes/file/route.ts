import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createSignedMediaUrl } from "@/lib/supabase/storage"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * A short-lived link to one file a patient attached to their registration.
 *
 * Session-gated, and built on the practitioner's own session like the document
 * link is: the intake row is read under row-level security, and the path is
 * only signed if that row lists it. Naming a path in the request is not enough
 * on its own — the row has to vouch for it.
 */

export const dynamic = "force-dynamic"

const PREVIEW_TTL_SECONDS = 300

const bodySchema = z.object({ intakeId: z.string().uuid(), path: z.string().min(1) })

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

  const db = await createSupabaseServerClient()
  if (!db) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 })

  const { data } = await db
    .from("patient_intakes")
    .select("document_paths")
    .eq("id", parsed.data.intakeId)
    .maybeSingle()

  const paths = (data?.document_paths as string[] | undefined) ?? []
  if (!paths.includes(parsed.data.path)) {
    return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 })
  }

  const url = await createSignedMediaUrl(parsed.data.path, PREVIEW_TTL_SECONDS)
  if (!url) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true, url })
}
