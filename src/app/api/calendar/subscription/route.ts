import { NextResponse } from "next/server"

import { feedTokenForClinic } from "@/features/calendar/lib/calendar-feed"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * The practitioner's own calendar subscription link.
 *
 * Session-gated by the middleware, and the clinic comes from their profile
 * rather than from the request: this route hands out a secret, so the one thing
 * it must never do is let a caller name whose secret they would like.
 *
 * GET returns the link, minting one on first use. POST replaces it, which is
 * what "the link leaked" looks like from the inside — the old URL resolves to
 * nothing the moment the new one exists.
 *
 * The feed itself lives under `/api/calendar-feed/`. The middleware exempts
 * public paths by prefix, so a public feed route beside this one would have
 * made this one public too.
 */

export const dynamic = "force-dynamic"

async function clinicOfCurrentUser(): Promise<string | null> {
  const db = await createSupabaseServerClient()
  if (!db) return null
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null
  const { data } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle()
  return data?.clinic_id ?? null
}

function urlFor(request: Request, token: string): string {
  return `${new URL(request.url).origin}/api/calendar-feed/${token}.ics`
}

export async function GET(request: Request) {
  const clinicId = await clinicOfCurrentUser()
  if (!clinicId) return NextResponse.json({ ok: false }, { status: 401 })

  const token = await feedTokenForClinic(clinicId)
  if (!token) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 })
  return NextResponse.json({ ok: true, url: urlFor(request, token) })
}

export async function POST(request: Request) {
  const clinicId = await clinicOfCurrentUser()
  if (!clinicId) return NextResponse.json({ ok: false }, { status: 401 })

  const token = await feedTokenForClinic(clinicId, { rotate: true })
  if (!token) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 })
  return NextResponse.json({ ok: true, url: urlFor(request, token), rotated: true })
}
