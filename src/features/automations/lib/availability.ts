import {
  addIsoDays,
  clinicHhmm,
  clinicIsoDate,
  weekdayIndexOfIsoDate,
} from "@/features/automations/lib/clinic-time"
import { hhmmFromMinutes, minutesFromHHMM } from "@/lib/appointment-time"
import { APPOINTMENT_SLOT_MINUTES } from "@/types/domain"
import type { AvailabilityWindow, ClinicAutomations } from "@/types/automation"
import type { ScheduleItem } from "@/types/domain"
import type { WeekdayScheduleSlot } from "@/types/clinic-settings"

/**
 * Free-slot computation for the patient-facing booking and reschedule pages.
 *
 * The rule that matters: a patient may only land inside a
 * `futureAvailability` window, which is intentionally narrower than clinic
 * opening hours. Opening hours say when the clinic *can* work; these windows
 * say what the practitioner is willing to hand out without being asked.
 *
 * Slots stay on the 5-minute grid and never overlap an existing appointment,
 * mirroring the Postgres constraints in `init_schema.sql` so a self-booked
 * visit can't be rejected by the database later.
 */

export interface FreeSlot {
  /** Clinic-local `YYYY-MM-DD`. */
  date: string
  /** Clinic-local `HH:mm`. */
  start: string
  end: string
}

export interface SlotQuery {
  automations: ClinicAutomations
  weekdays: WeekdayScheduleSlot[]
  /** Everything already booked — cancelled visits are ignored as free time. */
  appointments: ScheduleItem[]
  durationMinutes: number
  now?: Date
  /** Cap the returned list; the picker paginates by day, not by slot. */
  limit?: number
}

/** Windows for a weekday, clipped to that day's opening hours. */
function effectiveWindows(
  isoDate: string,
  automations: ClinicAutomations,
  weekdays: WeekdayScheduleSlot[],
): AvailabilityWindow[] {
  const weekdayIndex = weekdayIndexOfIsoDate(isoDate)
  const opening = weekdays.find((w) => w.weekdayIndex === weekdayIndex)
  if (!opening?.open) return []

  const openMin = minutesFromHHMM(opening.openTime)
  const closeMin = minutesFromHHMM(opening.closeTime)

  return automations.futureAvailability
    .filter((w) => w.weekdayIndex === weekdayIndex)
    .map((w) => {
      const start = Math.max(minutesFromHHMM(w.startTime), openMin)
      const end = Math.min(minutesFromHHMM(w.endTime), closeMin)
      return { ...w, startTime: hhmmFromMinutes(start), endTime: hhmmFromMinutes(end) }
    })
    .filter((w) => minutesFromHHMM(w.endTime) > minutesFromHHMM(w.startTime))
}

/** Busy ranges for a day, in minutes from midnight. */
function busyRanges(appointments: ScheduleItem[], isoDate: string): [number, number][] {
  return appointments
    .filter((a) => a.date === isoDate && a.status !== "cancelled")
    .map((a) => [minutesFromHHMM(a.start), minutesFromHHMM(a.end)] as [number, number])
}

export function findFreeSlots(query: SlotQuery): FreeSlot[] {
  const { automations, weekdays, appointments, durationMinutes } = query
  const now = query.now ?? new Date()
  const timezone = automations.timezone
  const { leadTimeHours, horizonDays } = automations.selfBooking
  const limit = query.limit ?? 60

  // Nothing before the lead time — patients must not grab a slot starting in
  // ten minutes.
  const earliest = new Date(now.getTime() + leadTimeHours * 3_600_000)
  const earliestDate = clinicIsoDate(earliest, timezone)
  const earliestMinute = minutesFromHHMM(clinicHhmm(earliest, timezone))

  const slots: FreeSlot[] = []
  let isoDate = clinicIsoDate(now, timezone)

  for (let dayOffset = 0; dayOffset <= horizonDays && slots.length < limit; dayOffset += 1) {
    const windows = effectiveWindows(isoDate, automations, weekdays)
    if (windows.length) {
      const busy = busyRanges(appointments, isoDate)

      for (const window of windows) {
        const windowStart = minutesFromHHMM(window.startTime)
        const windowEnd = minutesFromHHMM(window.endTime)

        for (
          let start = windowStart;
          start + durationMinutes <= windowEnd;
          start += APPOINTMENT_SLOT_MINUTES
        ) {
          if (slots.length >= limit) break
          if (isoDate < earliestDate) break
          if (isoDate === earliestDate && start < earliestMinute) continue

          const end = start + durationMinutes
          const clashes = busy.some(([bStart, bEnd]) => start < bEnd && bStart < end)
          if (clashes) continue

          slots.push({
            date: isoDate,
            start: hhmmFromMinutes(start),
            end: hhmmFromMinutes(end),
          })
        }
      }
    }
    isoDate = addIsoDays(isoDate, 1)
  }

  return slots
}

/** Group slots by day for the picker's day-then-time layout. */
export function groupSlotsByDate(slots: FreeSlot[]): { date: string; slots: FreeSlot[] }[] {
  const byDate = new Map<string, FreeSlot[]>()
  for (const slot of slots) {
    const list = byDate.get(slot.date)
    if (list) list.push(slot)
    else byDate.set(slot.date, [slot])
  }
  return [...byDate.entries()].map(([date, list]) => ({ date, slots: list }))
}
