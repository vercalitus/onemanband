import type { AppointmentStatus, ScheduleItem } from "@/types/domain"

/**
 * Status and slot changes that came from outside the clinic app.
 *
 * When a patient taps "Confirm" or "Cancel" in a reminder, the appointment's
 * status must actually change — a dashboard task alone leaves the calendar
 * lying about the day. The schedule itself lives in React state seeded from
 * `mock-data`, which the public pages cannot reach, so those pages write here
 * and `ScheduleDayProvider` applies the overlay on load.
 *
 * Supabase removes this entirely: the patient page updates the appointment row
 * and every reader sees it.
 */

const KEY = "clinic.appointment-overlay.v1"

export const APPOINTMENT_OVERLAY_EVENT = "appointment-overlay-changed"

export interface AppointmentOverlayEntry {
  status?: AppointmentStatus
  /** Set when the patient moved the visit rather than just answering. */
  date?: string
  start?: string
  end?: string
  updatedAt: string
}

type Overlay = Record<string, AppointmentOverlayEntry>

function readOverlay(): Overlay {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Overlay) : {}
  } catch {
    return {}
  }
}

function writeOverlay(next: Overlay): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(APPOINTMENT_OVERLAY_EVENT))
  } catch {
    /* quota / private mode */
  }
}

export function setAppointmentOverlay(
  appointmentId: string,
  entry: Omit<AppointmentOverlayEntry, "updatedAt">,
): void {
  if (!appointmentId) return
  const overlay = readOverlay()
  writeOverlay({
    ...overlay,
    [appointmentId]: { ...overlay[appointmentId], ...entry, updatedAt: new Date().toISOString() },
  })
}

/**
 * Apply patient-side changes over the clinic's schedule.
 *
 * A moved visit keeps its duration when the overlay only recorded a new start,
 * so a rescheduled 45-minute first visit does not silently shrink.
 */
export function applyAppointmentOverlay(appointments: ScheduleItem[]): ScheduleItem[] {
  const overlay = readOverlay()
  if (!Object.keys(overlay).length) return appointments

  return appointments.map((appointment) => {
    const entry = overlay[appointment.id]
    if (!entry) return appointment

    let end = appointment.end
    if (entry.end) {
      end = entry.end
    } else if (entry.start) {
      const [oh, om] = appointment.start.split(":").map(Number)
      const [eh, em] = appointment.end.split(":").map(Number)
      const duration = eh * 60 + em - (oh * 60 + om)
      const [nh, nm] = entry.start.split(":").map(Number)
      const total = nh * 60 + nm + duration
      end = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    }

    return {
      ...appointment,
      status: entry.status ?? appointment.status,
      date: entry.date ?? appointment.date,
      start: entry.start ?? appointment.start,
      end,
    }
  })
}

export function clearAppointmentOverlay(): void {
  writeOverlay({})
}
