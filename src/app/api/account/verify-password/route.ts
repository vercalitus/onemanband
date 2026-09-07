import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { clientEnv } from "@/lib/env"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Confirm that the caller knows their *current* password, without disturbing
 * their session.
 *
 * Changing a password is a client-side `updateUser` call, which only proves the
 * browser holds a valid session — not that the person at the keyboard is the
 * account owner. An unlocked laptop would be enough. So the current password is
 * checked first, and this route is that check.
 *
 * Why it is not done in the browser: the only way to verify a password with
 * Supabase is to sign in with it, and a fresh sign-in comes back at aal1. For a
 * practitioner with two-factor enrolled that means the middleware bounces them
 * to the TOTP screen in the middle of changing a password. Signing in here, on a
 * throwaway client that persists nothing, checks the same thing and leaves the
 * browser's session exactly as it was.
 *
 * The email is taken from the session, never from the request body — this route
 * can only ever test the caller's own password.
 */

export const dynamic = "force-dynamic"

const bodySchema = z.object({ password: z.string().min(1).max(200) })

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid password" }, { status: 400 })
  }

  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL
  const key = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const db = await createSupabaseServerClient()
  if (!db || !url || !key) {
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 })
  }

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ ok: false, reason: "no session" }, { status: 401 })
  }

  const probe = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await probe.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  })

  if (error) {
    return NextResponse.json({ ok: false, reason: "mismatch" }, { status: 401 })
  }

  // The session this created is never used. It lives in nothing but this
  // request's memory and expires on its own; signing it out here would need a
  // round trip to say nothing.
  return NextResponse.json({ ok: true })
}
