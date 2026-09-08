import { NextResponse, type NextRequest } from "next/server"

import {
  DEFAULT_CLINIC_TIMEZONE,
  clinicHhmm,
  clinicIsoDate,
} from "@/features/automations/lib/clinic-time"
import { findTokenRow } from "@/features/automations/lib/server-store"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * When the clinic is already busy, for the patient-facing booking pages.
 *
 * Those pages worked out free slots against the demo diary, because a patient
 * has no session and the browser cannot read the appointments table. So every
 * slot they offered was computed against a week that does not exist: the clinic
 * would have been double-booked the first time a patient used the link, and
 * genuinely free time would have been withheld because a fictional visit sat
 * in it.
 *
 * Authorised by the capability token in the request, exactly like the other
 * public routes — a caller without a live token gets nothing.
 *
 * What comes back is times and nothing else: a date, a start, an end. No
 * patient, no id, no reason for the visit. That is all the slot maths needs,
 * and anything more would tell whoever holds one patient's link about the
 * appointments of every other.
 */

export const dynamic = "force-dynamic"

/** As far ahead as self-booking can reach, with room to spare. */
const HORIZON_DAYS = 120

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("token")
  if (!value) return NextResponse.json({ ok: false, reason: "missing token" }, { status: 400 })

  const token = await findTokenRow(value)
  if (!token) return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 })
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 })
  }

  const db = createSupabaseAdminClient()
  if (!db) return NextResponse.json({ ok: true, busy: [] })

  const from = new Date()
  const to = new Date(from.getTime() + HORIZON_DAYS * 86_400_000)

  const { data, error } = await db
    .from("appointments")
    .select("start_time, end_time, status")
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString())
    .neq("status", "cancelled")

  // An empty diary and an unreadable one are not the same thing, but the safe
  // failure here is the same either way: offering a slot that turns out to be
  // taken is worse than offering none, so a failure returns nothing free by
  // returning nothing at all rather than pretending the day is empty.
  if (error) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 })

  const tz = DEFAULT_CLINIC_TIMEZONE
  const busy = (data as { start_time: string; end_time: string; status: string }[]).map((row) => ({
    date: clinicIsoDate(new Date(row.start_time), tz),
    start: clinicHhmm(new Date(row.start_time), tz),
    end: clinicHhmm(new Date(row.end_time), tz),
    status: row.status,
  }))

  return NextResponse.json({ ok: true, busy })
}
