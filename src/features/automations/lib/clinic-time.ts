/**
 * Clinic-timezone arithmetic.
 *
 * Automation timing is written in clinic wall-clock terms ("18:00 the evening
 * before"), but the outbox stores absolute UTC instants. These helpers convert
 * between the two without pulling in a date library, and they must stay correct
 * across the Israel DST switch — which is exactly why every conversion goes
 * through `Intl` rather than a fixed offset.
 */

export const DEFAULT_CLINIC_TIMEZONE = "Asia/Jerusalem"

type Parts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatterCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    partsFormatterCache.set(timeZone, fmt)
  }
  return fmt
}

/** Break an instant into clinic-local calendar parts. */
export function zonedParts(instant: Date, timeZone: string): Parts {
  const map: Record<string, string> = {}
  for (const p of partsFormatter(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = p.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Intl renders midnight as "24" in some engines under hour12:false.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** Offset in minutes that `timeZone` is ahead of UTC at the given instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000
}

/**
 * Clinic wall-clock → absolute instant.
 *
 * Two passes: guess with the offset at the naive instant, then re-measure at
 * the candidate. That settles DST boundaries, where the offset that applies is
 * the one at the *result*, not at the guess.
 */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0)
  let result = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000)
  result = new Date(naive - offsetMinutes(result, timeZone) * 60_000)
  return result
}

/** `YYYY-MM-DD` + `HH:mm` in clinic time → absolute instant. */
export function clinicDateTimeToUtc(timeZone: string, isoDate: string, hhmm: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number)
  const [hh, mm] = hhmm.split(":").map(Number)
  return zonedTimeToUtc(timeZone, y, m, d, hh || 0, mm || 0)
}

/** Clinic-local calendar date of an instant, as `YYYY-MM-DD`. */
export function clinicIsoDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/** Clinic-local `HH:mm` of an instant. */
export function clinicHhmm(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
}

/** Shift an ISO calendar date by whole days — no timezone involved. */
export function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

/** 0 = Monday … 6 = Sunday, matching `WeekdayScheduleSlot.weekdayIndex`. */
export function weekdayIndexOfIsoDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return (jsDay + 6) % 7
}

export const addMinutes = (instant: Date, minutes: number): Date =>
  new Date(instant.getTime() + minutes * 60_000)

export const addHours = (instant: Date, hours: number): Date =>
  new Date(instant.getTime() + hours * 3_600_000)

/** Human-facing date + time of an instant, rendered in clinic time. */
export function formatClinicDateTime(
  instant: Date,
  timeZone: string,
  locale: string,
): { date: string; time: string } {
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(instant)
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant)
  return { date, time }
}
