import { clinicDateTimeToUtc } from "@/features/automations/lib/clinic-time"
import type { ClinicAutomations } from "@/types/automation"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"

/**
 * Visits that are over and that nobody has accounted for.
 *
 * This fed a timer that marked them no-shows, charged them and messaged the
 * patient, on the theory that the clinic should not have to notice a no-show
 * at all. It cannot tell a patient who did not come from a session that was
 * treated and not closed — the second is the common case whenever saving fails
 * or the practitioner closes from another screen — and the timer billed both.
 * It now only finds them; the dashboard asks the practitioner what happened.
 */

/**
 * Statuses that still say "coming". `completed`, `cancelled` and `no_show`
 * are answers; `uncertain` is the practitioner already holding the question.
 */
const UNRESOLVED: AppointmentStatus[] = ["scheduled", "confirmed"]

/**
 * Appointments whose slot ended more than `noShowGraceMinutes` ago and were
 * never resolved. Pure — the caller decides what to do with them.
 */
export function findMissedAppointments(
  appointments: ScheduleItem[],
  automations: Pick<ClinicAutomations, "noShowGraceMinutes" | "timezone">,
  now: Date = new Date(),
): ScheduleItem[] {
  const cutoff = now.getTime() - automations.noShowGraceMinutes * 60_000
  return appointments.filter((appointment) => {
    if (!UNRESOLVED.includes(appointment.status)) return false
    const endedAt = clinicDateTimeToUtc(
      automations.timezone,
      appointment.date,
      appointment.end,
    ).getTime()
    return endedAt <= cutoff
  })
}
