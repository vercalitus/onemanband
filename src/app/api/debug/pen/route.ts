import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * TEMPORARY — a pen diagnostic, to be removed once the tablet ink is fixed.
 *
 * On the practitioner's iPad the ink lands beside the pen and comes out
 * doubled, and none of it reproduces on a desktop browser. This receives what
 * the tablet itself reports for each stroke — positions, scroll, the drawing's
 * size — and writes it to the server log, where it can be read against the
 * video of the same strokes.
 *
 * Coordinates and sizes only: no patient, no note, no image. Session-gated, and
 * the canvas only sends anything when the page was opened with `?penlog=1`.
 */

export const dynamic = "force-dynamic"

const MAX_BODY = 64_000

export async function POST(request: Request) {
  const db = await createSupabaseServerClient()
  if (!db) return NextResponse.json({ ok: false }, { status: 503 })
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const text = await request.text()
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 })
  console.log(`[pen-log] ${text}`)
  return NextResponse.json({ ok: true })
}
