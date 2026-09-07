import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createSignedMediaUrl } from "@/lib/supabase/storage"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * A short-lived link to one patient document.
 *
 * Session-gated by the middleware, and deliberately built on the practitioner's
 * own session rather than the service role. That is what makes it safe: the
 * document row is read under row-level security, and the storage object is
 * signed under the policy keyed on the clinic id in its path. A practitioner
 * asking for another clinic's document gets nothing, and this route contains no
 * logic that could get that check wrong — the database performs it.
 *
 * The caller names a document id, never a storage path. A path from a request
 * body would let someone ask for any object in the bucket by guessing, and the
 * only thing standing in the way would be code written here.
 */

export const dynamic = "force-dynamic"

const bodySchema = z.object({ documentId: z.string().uuid() })

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid document" }, { status: 400 })
  }

  const db = await createSupabaseServerClient()
  if (!db) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 })

  const { data } = await db
    .from("documents")
    .select("storage_path")
    .eq("id", parsed.data.documentId)
    .maybeSingle()

  // Not found and not permitted look identical here, and should: RLS returns
  // nothing in both cases, and telling them apart would confirm the existence
  // of another clinic's record.
  if (!data?.storage_path) {
    return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 })
  }

  const url = await createSignedMediaUrl(data.storage_path)
  if (!url) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 })

  return NextResponse.json({ ok: true, url })
}
