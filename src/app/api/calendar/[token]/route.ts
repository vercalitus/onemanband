import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { fetchAppointmentsForFeed } from "@/features/calendar/lib/calendar-feed"
import { serverEnv } from "@/lib/env"

/**
 * The clinic's diary as a calendar subscription.
 *
 * Google fetches this on a schedule with no session and no cookies, so the
 * secret in the path is the whole authorisation — the same shape as the
 * patient-facing links, and it carries the same warning: anyone holding the URL
 * sees who is booked and when. It is unguessable, it is never linked from
 * anywhere, and it can be changed by changing one environment variable.
 *
 * Read-only by design. Google will not write back, and the app stays the single
 * place an appointment is made or moved.
 */

export const dynamic = "force-dynamic"

function authorised(token: string): boolean {
  const expected = serverEnv.CALENDAR_FEED_TOKEN
  if (!expected) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  // Length is not a secret, and timingSafeEqual throws on a mismatch.
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  // `.ics` in the path keeps some clients happy; it is not part of the secret.
  if (!authorised(token.replace(/\.ics$/i, ""))) {
    return new NextResponse("not found", { status: 404 })
  }

  const body = await fetchAppointmentsForFeed()

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Subscribed calendars are polled; there is nothing to gain from a cache
      // in front of one, and plenty to lose when a visit moves.
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="onemanband.ics"',
    },
  })
}
