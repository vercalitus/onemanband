import "server-only"

import { randomBytes } from "node:crypto"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * The clinic's diary rendered as iCalendar text, and the secret that addresses
 * it.
 *
 * The token belongs to a clinic rather than to the deploy. One token per
 * practitioner is what makes this work for more than one of them: the feed
 * resolves the token to a clinic and returns only that clinic's appointments,
 * so a link can never show someone else's day. It also means a leaked link is
 * fixed by the person holding it, from Settings, rather than by editing a
 * deploy.
 *
 * Times go out as UTC instants (`...Z`) rather than local wall-clock with a
 * timezone reference. It is the one form every calendar client agrees on, and
 * the database already stores instants, so nothing is converted and nothing can
 * drift when Israel changes its clocks.
 */

const WINDOW_BACK_DAYS = 30
const WINDOW_AHEAD_DAYS = 365

interface FeedRow {
  id: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  updated_at: string | null
  patients?: { full_name: string } | null
}

/* ---------------------------------------------------------------- token --- */

const newToken = () => randomBytes(24).toString("base64url")

/** The clinic a subscription link belongs to, or null if it belongs to none. */
export async function clinicForFeedToken(token: string): Promise<string | null> {
  const db = createSupabaseAdminClient()
  if (!db || token.length < 24) return null
  const { data } = await db
    .from("clinics")
    .select("id")
    .eq("calendar_feed_token", token)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * This clinic's subscription token, minted on first use.
 *
 * `rotate` replaces it, which is what "the link leaked" looks like from the
 * inside: the old URL stops resolving to anything the moment the new one
 * exists, because the lookup is by exact value.
 */
export async function feedTokenForClinic(
  clinicId: string,
  { rotate = false }: { rotate?: boolean } = {},
): Promise<string | null> {
  const db = createSupabaseAdminClient()
  if (!db) return null

  if (!rotate) {
    const { data } = await db
      .from("clinics")
      .select("calendar_feed_token")
      .eq("id", clinicId)
      .maybeSingle()
    if (data?.calendar_feed_token) return data.calendar_feed_token
  }

  const token = newToken()
  const { error } = await db
    .from("clinics")
    .update({ calendar_feed_token: token })
    .eq("id", clinicId)
  return error ? null : token
}

/* ------------------------------------------------------------ ical text --- */

/** `YYYYMMDDTHHMMSSZ`, which is what iCalendar wants. */
const stamp = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

/**
 * Escape per RFC 5545: commas, semicolons and backslashes are separators in
 * this format, and a patient named "Cohen, Dana" would otherwise split a line
 * into two fields.
 */
const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/**
 * Fold at 75 octets, as the spec requires. Long Hebrew names exceed it easily
 * and some clients simply drop an over-long line.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8")
  if (bytes.length <= 75) return line
  const out: string[] = []
  let start = 0
  while (start < bytes.length) {
    // Step back to a character boundary so a multi-byte glyph is never split.
    let end = Math.min(start + (out.length ? 74 : 75), bytes.length)
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    out.push((out.length ? " " : "") + bytes.subarray(start, end).toString("utf8"))
    start = end
  }
  return out.join("\r\n")
}

export async function buildFeedForClinic(clinicId: string): Promise<string> {
  const db = createSupabaseAdminClient()
  const now = new Date()

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OneManBand//Clinic Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:OneManBand",
    // A hint, not a promise: Google refreshes external calendars on its own
    // schedule and is free to ignore this.
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ]

  if (db) {
    const from = new Date(now.getTime() - WINDOW_BACK_DAYS * 86_400_000).toISOString()
    const to = new Date(now.getTime() + WINDOW_AHEAD_DAYS * 86_400_000).toISOString()

    const { data } = await db
      .from("appointments")
      .select("id, start_time, end_time, status, notes, updated_at, patients(full_name)")
      // The whole point of the token belonging to a clinic.
      .eq("clinic_id", clinicId)
      .gte("start_time", from)
      .lte("start_time", to)
      .order("start_time", { ascending: true })

    for (const row of (data ?? []) as unknown as FeedRow[]) {
      const name = row.patients?.full_name?.trim()
      lines.push(
        "BEGIN:VEVENT",
        `UID:${row.id}@onemanband`,
        `DTSTAMP:${stamp(now.toISOString())}`,
        `DTSTART:${stamp(row.start_time)}`,
        `DTEND:${stamp(row.end_time)}`,
        // A cancelled visit is published as cancelled rather than dropped, so
        // it disappears from a calendar that already has it. Removing the event
        // from the feed leaves some clients showing it for ever.
        `STATUS:${row.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
        fold(`SUMMARY:${escape(name ? `תור — ${name}` : "תור")}`),
      )
      if (row.notes) lines.push(fold(`DESCRIPTION:${escape(row.notes)}`))
      // Bumping the sequence on every update is what tells a client the event
      // it already holds is stale.
      lines.push(
        `LAST-MODIFIED:${stamp(row.updated_at ?? row.start_time)}`,
        `SEQUENCE:${Math.floor(new Date(row.updated_at ?? row.start_time).getTime() / 1000)}`,
        "END:VEVENT",
      )
    }
  }

  lines.push("END:VCALENDAR")
  // iCalendar is CRLF-delimited, and a plain \n breaks stricter parsers.
  return lines.join("\r\n") + "\r\n"
}
