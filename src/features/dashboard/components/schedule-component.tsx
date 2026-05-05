import type { ScheduleItem } from "@/types/domain"
import { AppointmentCard } from "@/features/dashboard/components/appointment-card"

export function ScheduleComponent({
  appointments,
}: {
  appointments: ScheduleItem[]
}) {
  return (
    <div className="relative pl-7">
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-[rgb(232,228,220)]" />
      <div className="space-y-5">
        {appointments.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        ))}
      </div>
    </div>
  )
}
