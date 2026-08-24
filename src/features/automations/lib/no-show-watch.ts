import { clinicDateTimeToUtc } from "@/features/automations/lib/clinic-time"
import type { ClinicAutomations } from "@/types/automation"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"

/**
 * Detects visits the patient silently missed.
 *
 * The spec asks the system to *wait a defined time and then* message the
 * patient — meaning the clinic should not have to notice the no-show at all.
 * Without this the `noShowGraceMinutes` setting is decorative: the sequence
 * only fires when a human marks the status by hand, which is exactly the work
 * the automation exists to remove.
 */

/**
 * Statuses that can still decay into a no-show.
 *
 * `confirmed` is included deliberately — a patient confirming and then not
 * turning up is the common case, not the rare one. `completed`, `cancelled`
 * and `no_show` are already resolved; `uncertain` means the clinician is
 * actively unsure and should not be overridden by a timer.
 */
const DECAYABLE: AppointmentStatus[] = ["scheduled", "confirmed"]

/**
 * Appointments whose slot ended more than `noShowGraceMinutes` ago and were
 * never resolved. Pure — the caller decides what to do with them.
 */
export function findMissedAppointments(
  appointments: ScheduleItem[],
  automations: ClinicAutomations,
  now: Date = new Date(),
): ScheduleItem[] {
  const cutoff = now.getTime() - automations.noShowGraceMinutes * 60_000
  return appointments.filter((appointment) => {
    if (!DECAYABLE.includes(appointment.status)) return false
    const endedAt = clinicDateTimeToUtc(
      automations.timezone,
      appointment.date,
      appointment.end,
    ).getTime()
    return endedAt <= cutoff
  })
}
