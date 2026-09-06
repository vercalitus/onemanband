import { NextResponse, type NextRequest } from "next/server"

import { runTick } from "@/features/automations/lib/dispatcher"
import { resolveServerDispatcher } from "@/features/automations/lib/live-dispatcher"
import {
  dueMessageRows,
  updateMessageRow,
} from "@/features/automations/lib/server-store"
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

function unauthorized(reason: string) {
  // The reason goes to the server log, not to the caller: an unauthenticated
  // request has no business learning how the gate is configured.
  console.error(`[automations/tick] refused: ${reason}`)
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

/**
 * Shared-secret gate. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * With no secret configured the route stays open in mock mode (there is
 * nothing to protect yet) but refuses once real credentials are in play.
 *
 * The refusal used to be a bare 401, which is indistinguishable from a wrong
 * secret and cost an afternoon to diagnose — the deploy had simply grown a
 * database and locked its own cron out. It now says which of the two happened.
 */
function authorize(request: NextRequest): string | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return isSupabaseConfigured()
      ? "CRON_SECRET is not set, and this deploy is configured. Set it here and in the cron caller."
      : null
  }
  return request.headers.get("authorization") === `Bearer ${secret}`
    ? null
    : "Authorization header does not carry the expected bearer secret."
}

export async function GET(request: NextRequest) {
  const refusal = authorize(request)
  if (refusal) return unauthorized(refusal)

  // The live providers only exist here: this is the server, and their
  // credentials must not travel any further than it. The queue is the database
  // for the same reason the cron exists at all — nothing in a browser is
  // reachable at 18:00 when the browser is closed.
  const summary = await runTick(new Date(), resolveServerDispatcher(), {
    due: dueMessageRows,
    update: updateMessageRow,
  })
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
