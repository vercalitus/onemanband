import type { ScheduleItem } from "@/types/domain"
import {
  APPOINTMENT_SLOT_MINUTES,
  MAX_APPOINTMENT_MINUTES,
  MIN_APPOINTMENT_MINUTES,
} from "@/types/domain"

/** Visible day window on the dashboard / calendar (local wall-clock for mock UI). */
export const CALENDAR_HOUR_START = 8
export const CALENDAR_HOUR_END = 19

const DAY_START_MIN = CALENDAR_HOUR_START * 60
const DAY_END_MIN = CALENDAR_HOUR_END * 60

export function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

export function hhmmFromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function snapMinutesToSlotFloor(minutes: number): number {
  const s = APPOINTMENT_SLOT_MINUTES
  return Math.floor(minutes / s) * s
}

export function snapMinutesToSlotNearest(minutes: number): number {
  const s = APPOINTMENT_SLOT_MINUTES
  return Math.round(minutes / s) * s
}

export function clampDurationMinutes(duration: number): number {
  const s = APPOINTMENT_SLOT_MINUTES
  const rounded = Math.round(duration / s) * s
  return Math.min(MAX_APPOINTMENT_MINUTES, Math.max(MIN_APPOINTMENT_MINUTES, rounded))
}

/**
 * Half-open ranges [start, end) in minutes-from-midnight.
 * Touching slots do not overlap (e.g. end 09:00 and start 09:00 is allowed).
 */
export function rangesOverlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function findOverlappingAppointment(
  appointments: ScheduleItem[],
  startMin: number,
  endMin: number,
  excludeId?: string,
): ScheduleItem | null {
  for (const a of appointments) {
    if (excludeId && a.id === excludeId) continue
    const s = minutesFromHHMM(a.start)
    const e = minutesFromHHMM(a.end)
    if (rangesOverlapMinutes(startMin, endMin, s, e)) return a
  }
  return null
}

export function isWithinCalendarDayWindow(startMin: number, endMin: number): boolean {
  return startMin >= DAY_START_MIN && endMin <= DAY_END_MIN && endMin > startMin
}

export function clampStartForDuration(startMin: number, durationMin: number): number {
  const latestStart = DAY_END_MIN - durationMin
  return Math.min(Math.max(startMin, DAY_START_MIN), latestStart)
}
