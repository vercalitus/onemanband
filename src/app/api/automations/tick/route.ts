import { NextResponse, type NextRequest } from "next/server"

import { runTick } from "@/features/automations/lib/dispatcher"
import { resolveServerDispatcher } from "@/features/automations/lib/live-dispatcher"
import { isSupabaseConfigured } from "@/lib/env"

/**
 * Cron entry point: deliver every automation message that has come due.
 *
 * Wire it up in `vercel.json` once a provider exists:
 *   { "crons": [{ "path": "/api/automations/tick", "schedule": "*​/5 * * * *" }] }
 *
 * Mock-mode caveat, stated plainly: the queue lives in the browser's
 * localStorage, and this route runs on the server where that does not exist.
 * So today it processes the server's own in-memory queue (usually empty) and
 * the browser drives ticking itself. The route is here because it is the shape
 * the real system needs, and it starts working the moment the store is backed
 * by Supabase instead.
 */

/** Never cached — a cron hitting a cached tick would deliver nothing. */
export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

/**
 * Shared-secret gate. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * With no secret configured the route stays open in mock mode (there is
 * nothing to protect yet) but refuses once real credentials are in play.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return !isSupabaseConfigured()
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  // The live providers only exist here: this is the server, and their
  // credentials must not travel any further than it.
  const summary = await runTick(new Date(), resolveServerDispatcher())
  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    ...summary,
    note: summary.simulated
      ? "No messaging provider configured — messages were validated and marked simulated."
      : undefined,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
