import { NextResponse } from "next/server"

import { buildFeedForClinic, clinicForFeedToken } from "@/features/calendar/lib/calendar-feed"

/**
 * A clinic's diary as a calendar subscription.
 *
 * Google fetches this on a schedule with no session and no cookies, so the
 * secret in the path is the whole authorisation — the same shape as the
 * patient-facing links, and it carries the same warning: anyone holding the URL
 * sees who is booked and when. It is unguessable, never linked from anywhere,
 * and the practitioner can replace it from Settings.
 *
 * The token identifies a *clinic*, and the feed returns only that clinic's
 * appointments. That is what makes it safe to hand one to every practitioner
 * rather than to the deploy.
 *
 * Read-only by design. Google will not write back, and the app stays the single
 * place an appointment is made or moved.
 *
 * It lives under its own path prefix, away from `/api/calendar/subscription`,
 * because the middleware exempts public routes by prefix — putting the two
 * beside each other would have made the route that *hands out* the secret
 * public as well.
 */

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  // `.ics` in the path keeps some clients happy; it is not part of the secret.
  const clinicId = await clinicForFeedToken(token.replace(/\.ics$/i, ""))

  // 404 rather than 403: an unknown token should not be able to tell the
  // difference between "wrong" and "revoked", or confirm that this is a
  // calendar endpoint at all.
  if (!clinicId) return new NextResponse("not found", { status: 404 })

  return new NextResponse(await buildFeedForClinic(clinicId), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Subscribed calendars are polled; there is nothing to gain from a cache
      // in front of one, and plenty to lose when a visit moves.
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="onemanband.ics"',
    },
  })
}
