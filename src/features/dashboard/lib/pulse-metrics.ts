"use client"

import { minutesFromHHMM } from "@/lib/appointment-time"
import type { ClinicSettings } from "@/types/clinic-settings"
import type { BillingInvoice, PulseMetric, ScheduleItem } from "@/types/domain"

/**
 * The four numbers at the top of the dashboard, computed from the clinic's own
 * records.
 *
 * They used to be constants: "342 Monthly Visits", "₪74.2k Monthly Revenue,
 * +9%". They were written for a demonstration and never removed, so a clinic
 * with an empty ledger was shown a healthy month in the exact place a business
 * looks to find out how its month is going. A zero is a fact; an invented
 * number is not, and the invented one is impossible to tell apart from the
 * real thing.
 *
 * So a clinic that has billed nothing sees zero, and that zero also says
 * something true: the system is connected and nothing has gone through it yet.
 */

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`

/** Whole shekels with a thousands separator; ₪74,200 rather than ₪74.2k. */
const money = (amount: number, formatMoney: (n: number) => string) => formatMoney(Math.round(amount))

/**
 * A change is only worth showing when there is something to compare with. A
 * first month has no previous month, and "+100%" against nothing is noise
 * dressed as a trend.
 */
function change(current: number, previous: number): Pick<PulseMetric, "delta" | "trend"> {
  if (previous <= 0) return { delta: "", trend: "steady" }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { delta: "0%", trend: "steady" }
  return { delta: `${pct > 0 ? "+" : ""}${pct}%`, trend: pct > 0 ? "up" : "down" }
}

/**
 * A visit that took place. A booking for the 28th is not a visit on the 9th:
 * the diary runs months ahead, and counting it made "Monthly Visits" a count of
 * bookings that read as a count of people seen.
 */
const isoToday = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
const visitHappened = (a: ScheduleItem, today: string) =>
  a.status === "completed" ||
  a.status === "checked_in" ||
  ((a.status === "confirmed" || a.status === "scheduled") && a.date < today)

function bookedMinutes(appointments: ScheduleItem[]): number {
  return appointments.reduce((sum, a) => {
    const span = minutesFromHHMM(a.end) - minutesFromHHMM(a.start)
    return sum + (Number.isFinite(span) && span > 0 ? span : 0)
  }, 0)
}

/**
 * Minutes the clinic is open across the month, from the configured week. An
 * approximation — it counts every occurrence of each weekday in the month and
 * knows nothing about holidays — and it is the denominator of a percentage
 * rounded to whole points, which is the accuracy the number is read at.
 */
function openMinutesInMonth(settings: ClinicSettings, month: Date): number {
  const perWeekday = new Map<number, number>()
  for (const day of settings.weekdays) {
    if (!day.open) continue
    const span = minutesFromHHMM(day.closeTime) - minutesFromHHMM(day.openTime)
    if (span > 0) perWeekday.set(day.weekdayIndex, span)
  }
  if (!perWeekday.size) return 0

  const year = month.getFullYear()
  const m = month.getMonth()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  let total = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    // Settings count Monday as 0; JavaScript counts Sunday as 0.
    const jsDay = new Date(year, m, day).getDay()
    total += perWeekday.get((jsDay + 6) % 7) ?? 0
  }
  return total
}

export function computePulseMetrics(
  appointments: ScheduleItem[],
  invoices: BillingInvoice[],
  settings: ClinicSettings,
  formatMoney: (n: number) => string,
  now: Date = new Date(),
): PulseMetric[] {
  const thisMonth = monthKey(now)
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = monthKey(previous)

  const inMonth = (iso: string | null | undefined, key: string) => {
    if (!iso) return false
    const d = new Date(iso)
    return !Number.isNaN(d.getTime()) && monthKey(d) === key
  }

  const today = isoToday(now)
  const visitsIn = (key: string) =>
    appointments.filter((a) => visitHappened(a, today) && inMonth(a.date, key))

  const visits = visitsIn(thisMonth)
  const visitsLast = visitsIn(lastMonth)

  const paidIn = (key: string) =>
    invoices
      .filter((i) => i.paymentStatus === "paid" && inMonth(i.paidAt ?? i.issuedAt, key))
      .reduce((sum, i) => sum + i.amount, 0)

  const revenue = paidIn(thisMonth)
  const revenueLast = paidIn(lastMonth)

  // Everything still owed, not only this month's — a debt does not stop being
  // one when the month turns over.
  const debt = invoices
    .filter((i) => i.paymentStatus !== "paid" && i.status !== "void")
    .reduce((sum, i) => sum + i.amount, 0)

  const openMinutes = openMinutesInMonth(settings, now)
  const capacity = openMinutes > 0 ? Math.round((bookedMinutes(visits) / openMinutes) * 100) : 0
  const openMinutesLast = openMinutesInMonth(settings, previous)
  const capacityLast =
    openMinutesLast > 0 ? Math.round((bookedMinutes(visitsLast) / openMinutesLast) * 100) : 0

  return [
    { id: "visits", label: "Monthly Visits", value: String(visits.length), ...change(visits.length, visitsLast.length) },
    {
      id: "capacity",
      label: "Treatment Capacity",
      value: `${capacity}%`,
      delta: capacityLast > 0 ? `${capacity - capacityLast >= 0 ? "+" : ""}${capacity - capacityLast} pp MoM` : "",
      trend: capacity === capacityLast ? "steady" : capacity > capacityLast ? "up" : "down",
    },
    { id: "revenue", label: "Monthly Revenue", value: money(revenue, formatMoney), ...change(revenue, revenueLast) },
    {
      id: "debt",
      label: "Open Debt",
      value: money(debt, formatMoney),
      delta: "",
      // Money owed is not an achievement in either direction; it is a number to
      // act on, and an arrow would only editorialise.
      trend: "steady",
    },
  ]
}
