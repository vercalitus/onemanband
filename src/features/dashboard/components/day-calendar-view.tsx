"use client"

import Link from "next/link"
import { FolderOpen, Plus } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { appointmentTypeVisual } from "@/lib/appointment-types"
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  clampStartForDuration,
  minutesFromHHMM,
  snapMinutesToSlotNearest,
} from "@/lib/appointment-time"
import { cn } from "@/lib/utils"

const DAY_START_MIN = CALENDAR_HOUR_START * 60
const DAY_END_MIN = CALENDAR_HOUR_END * 60

const statusStyle: Record<
  AppointmentStatus,
  { card: string; dot: string; badge: string; label: string }
> = {
  confirmed: {
    card: "border-emerald-200 bg-emerald-50",
    dot: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Confirmed",
  },
  scheduled: {
    card: "border-sky-200 bg-sky-50",
    dot: "bg-sky-400",
    badge: "bg-sky-100 text-sky-700",
    label: "Scheduled",
  },
  checked_in: {
    card: "border-indigo-200 bg-indigo-50",
    dot: "bg-indigo-400",
    badge: "bg-indigo-100 text-indigo-700",
    label: "Checked in",
  },
  completed: {
    card: "border-slate-200 bg-slate-50",
    dot: "bg-slate-300",
    badge: "bg-slate-100 text-slate-500",
    label: "Done",
  },
  cancelled: {
    card: "border-rose-100 bg-rose-50",
    dot: "bg-rose-300",
    badge: "bg-rose-100 text-rose-500",
    label: "Cancelled",
  },
  no_show: {
    card: "border-orange-100 bg-orange-50",
    dot: "bg-orange-300",
    badge: "bg-orange-100 text-orange-500",
    label: "No show",
  },
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

/** One horizontal divider when the chronological list crosses “now”; keeps the timeline scannable without a left hour rail. */
function NowDivider() {
  return (
    <div
      className="flex items-center gap-2 py-1.5"
      role="separator"
      aria-label="Current time"
    >
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-600">
        Now
      </span>
      <div className="h-px min-w-0 flex-1 bg-sky-400" />
      <span className="size-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
    </div>
  )
}

export function DayCalendarView({
  appointments,
  onAppointmentsChange,
}: {
  appointments: ScheduleItem[]
  onAppointmentsChange: (next: ScheduleItem[]) => void
}) {
  const sorted = useMemo(() => sortByStart(appointments), [appointments])

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const showNowLine =
    currentMinutes >= DAY_START_MIN && currentMinutes < DAY_END_MIN

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("edit")
  const [activeAppointment, setActiveAppointment] = useState<ScheduleItem | null>(null)
  const [defaultStartMinutes, setDefaultStartMinutes] = useState<number | undefined>(undefined)

  const openEdit = (apt: ScheduleItem) => {
    setDialogMode("edit")
    setActiveAppointment(apt)
    setDefaultStartMinutes(undefined)
    setDialogOpen(true)
  }

  const openCreateDefault = () => {
    const defaultDuration = 15
    const snapped = snapMinutesToSlotNearest(currentMinutes)
    const clamped = clampStartForDuration(snapped, defaultDuration)
    setDialogMode("create")
    setActiveAppointment(null)
    setDefaultStartMinutes(clamped)
    setDialogOpen(true)
  }

  /** Renders appointments as equal-height tiles so brief visits stay as readable as long ones while order still follows clock time. */
  const tiles = () => {
    let markerPlaced = false
    let prevEnd: number | null = null
    const nodes: ReactNode[] = []

    for (const apt of sorted) {
      const startMin = minutesFromHHMM(apt.start)
      const endMin = minutesFromHHMM(apt.end)

      if (showNowLine && !markerPlaced) {
        const gapStart = prevEnd ?? DAY_START_MIN
        if (currentMinutes >= gapStart && currentMinutes < startMin) {
          nodes.push(<NowDivider key={`now-gap-${apt.id}`} />)
          markerPlaced = true
        }
      }

      if (showNowLine && !markerPlaced && currentMinutes >= startMin && currentMinutes < endMin) {
        nodes.push(<NowDivider key={`now-in-${apt.id}`} />)
        markerPlaced = true
      }

      const style = statusStyle[apt.status]
      const typeStyle = appointmentTypeVisual[apt.appointmentType]

      nodes.push(
        <div
          key={apt.id}
          role="button"
          tabIndex={0}
          className={cn(
            "mb-2 flex min-h-[96px] cursor-pointer gap-3 overflow-hidden rounded-xl border px-3 py-3 pr-4 transition-shadow focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
            style.card,
            typeStyle.stripe,
            "shadow-sm hover:z-10 hover:shadow-md",
          )}
          onClick={() => openEdit(apt)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openEdit(apt)
            }
          }}
        >
          <span className={cn("mt-1 size-2 shrink-0 rounded-full self-start", style.dot)} aria-hidden />
          <div className="min-w-0 flex flex-1 flex-col justify-between gap-1">
            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
              <p className="font-mono text-sm font-semibold tracking-tight text-slate-900 tabular-nums">
                <time dateTime={`${apt.start}`}>{apt.start}</time>
                {" — "}
                <time dateTime={`${apt.end}`}>{apt.end}</time>
              </p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", style.badge)}>
                  {style.label}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", typeStyle.chip)}>
                  {typeStyle.label}
                </span>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[15px] font-semibold text-slate-900">{apt.patientName}</p>
              <Link
                href={`/patients/${apt.patientId}?tab=records`}
                className="shrink-0 text-slate-400 hover:text-slate-700"
                title="Medical records"
                onClick={(e) => e.stopPropagation()}
              >
                <FolderOpen className="size-4 stroke-[1.6]" aria-hidden />
                <span className="sr-only">Open chart for {apt.patientName}</span>
              </Link>
            </div>
            <p className="truncate text-xs leading-snug text-slate-600">{apt.treatment}</p>
          </div>
        </div>,
      )

      prevEnd = endMin
    }

    if (showNowLine && !markerPlaced && currentMinutes >= (prevEnd ?? DAY_START_MIN) && currentMinutes < DAY_END_MIN) {
      nodes.push(<NowDivider key="now-trailing" />)
    }

    return nodes
  }

  return (
    <>
      <ScrollArea className="h-[min(70vh,520px)] md:h-[500px]">
        <div className="scroll-pb-24">
          <div className="pr-3">{tiles()}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 mb-10 w-full border-dashed border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={openCreateDefault}
          >
            <Plus className="mr-2 size-4 shrink-0" aria-hidden />
            Add appointment
          </Button>
        </div>
      </ScrollArea>

      <AppointmentEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        appointment={activeAppointment}
        defaultStartMinutes={defaultStartMinutes}
        allAppointments={appointments}
        onSave={(item, { isNew }) => {
          if (isNew) onAppointmentsChange(sortByStart([...appointments, item]))
          else onAppointmentsChange(sortByStart(appointments.map((a) => (a.id === item.id ? item : a))))
        }}
      />
    </>
  )
}
