"use client"

import Link from "next/link"
import { FolderOpen, Plus } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { appointmentTypeVisual } from "@/lib/appointment-types"
import { hasOutstandingBalance } from "@/features/calendar/lib/payment-status"
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

/**
 * Lightweight status tone — we render status as a small text label/dot in the
 * top-right of the card. The card's main fill is driven by appointment _type_,
 * not status, so colors don't fight each other.
 */
const statusTone: Record<AppointmentStatus, { dot: string; label: string; text: string }> = {
  confirmed: { dot: "bg-emerald-400", label: "Confirmed", text: "text-emerald-700" },
  scheduled: { dot: "bg-sky-400", label: "Scheduled", text: "text-sky-700" },
  checked_in: { dot: "bg-indigo-400", label: "Checked in", text: "text-indigo-700" },
  completed: { dot: "bg-slate-300", label: "Done", text: "text-slate-500" },
  cancelled: { dot: "bg-rose-300", label: "Cancelled", text: "text-rose-500" },
  no_show: { dot: "bg-orange-300", label: "No show", text: "text-orange-600" },
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

function hourOf(hhmm: string): number {
  return Math.floor(minutesFromHHMM(hhmm) / 60)
}

/** One horizontal divider when the chronological list crosses “now”; keeps the timeline scannable without a left hour rail. */
function NowDivider() {
  return (
    <div className="flex items-center gap-2 py-1.5" role="separator" aria-label="Current time">
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-600">Now</span>
      <div className="h-px min-w-0 flex-1 bg-sky-400" />
      <span className="size-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
    </div>
  )
}

/** Subtle hour separator inserted when the next appointment moves into a new hour. */
function HourDivider({ hour }: { hour: number }) {
  const label = `${String(hour).padStart(2, "0")}:00`
  return (
    <div className="flex items-center gap-2 pb-1.5 pt-2" aria-hidden>
      <span className="shrink-0 font-mono text-[10px] font-medium tracking-wider text-slate-400">{label}</span>
      <div className="h-px min-w-0 flex-1 bg-slate-100" />
    </div>
  )
}

export function DayCalendarView({
  appointments,
  onAppointmentsChange,
  showCanceled = true,
  showAddButton = true,
  heightClassName = "h-[min(70vh,520px)] md:h-[500px]",
}: {
  appointments: ScheduleItem[]
  onAppointmentsChange: (next: ScheduleItem[]) => void
  /** When false, cancelled appointments are filtered out of the list (used by /calendar). */
  showCanceled?: boolean
  /** Hide the trailing "Add appointment" CTA when an external button already exists. */
  showAddButton?: boolean
  /** Override scroll-area height — calendar page wants a taller viewport than the dashboard widget. */
  heightClassName?: string
}) {
  const visible = useMemo(() => {
    const list = showCanceled ? appointments : appointments.filter((a) => a.status !== "cancelled")
    return sortByStart(list)
  }, [appointments, showCanceled])

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const showNowLine = currentMinutes >= DAY_START_MIN && currentMinutes < DAY_END_MIN

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
    let prevHour: number | null = null
    const nodes: ReactNode[] = []

    visible.forEach((apt, idx) => {
      const startMin = minutesFromHHMM(apt.start)
      const endMin = minutesFromHHMM(apt.end)
      const startHour = hourOf(apt.start)

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

      // Subtle hour rule between cards that cross into a new hour (skip before first card).
      if (idx > 0 && prevHour !== null && startHour !== prevHour) {
        nodes.push(<HourDivider key={`hour-${apt.id}`} hour={startHour} />)
      }

      const status = statusTone[apt.status]
      const typeStyle = appointmentTypeVisual[apt.appointmentType]
      const isCancelled = apt.status === "cancelled"
      const debt = hasOutstandingBalance(apt.patientId)

      nodes.push(
        <div
          key={apt.id}
          role="button"
          tabIndex={0}
          className={cn(
            "mb-2 flex min-h-[96px] cursor-pointer gap-3 overflow-hidden rounded-xl border px-3 py-3 pr-4 transition-shadow focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
            typeStyle.surface,
            typeStyle.stripe,
            "shadow-sm hover:z-10 hover:shadow-md",
            isCancelled && "opacity-60",
          )}
          onClick={() => openEdit(apt)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openEdit(apt)
            }
          }}
        >
          <span
            className={cn(
              "mt-1 size-2 shrink-0 self-start rounded-full ring-2 ring-white",
              debt ? "bg-rose-500" : "bg-emerald-500",
            )}
            aria-hidden
            title={debt ? "Outstanding balance" : "Balance settled"}
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
              <p
                className={cn(
                  "font-mono text-sm font-semibold tracking-tight text-slate-900 tabular-nums",
                  isCancelled && "line-through decoration-rose-400/70",
                )}
              >
                <time dateTime={`${apt.start}`}>{apt.start}</time>
                {" — "}
                <time dateTime={`${apt.end}`}>{apt.end}</time>
              </p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider", status.text)}>
                  <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
                  {status.label}
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", typeStyle.chip)}>
                  {typeStyle.label}
                </span>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="line-clamp-1 text-[15px] font-semibold text-slate-900">{apt.patientName}</p>
              <Link
                href={`/patients/${apt.patientId}?tab=records`}
                className="shrink-0 text-slate-400 transition-colors hover:text-sky-600"
                title="Medical records"
                onClick={(e) => e.stopPropagation()}
              >
                <FolderOpen className="size-4 stroke-[1.6]" aria-hidden />
                <span className="sr-only">Open chart for {apt.patientName}</span>
              </Link>
            </div>
            <p className="line-clamp-2 text-xs leading-snug text-slate-600">{apt.treatment}</p>
          </div>
        </div>,
      )

      prevEnd = endMin
      prevHour = startHour
    })

    if (showNowLine && !markerPlaced && currentMinutes >= (prevEnd ?? DAY_START_MIN) && currentMinutes < DAY_END_MIN) {
      nodes.push(<NowDivider key="now-trailing" />)
    }

    if (nodes.length === 0) {
      nodes.push(
        <p
          key="empty"
          className="my-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400"
        >
          No appointments for this day.
        </p>,
      )
    }

    return nodes
  }

  return (
    <>
      <ScrollArea className={heightClassName}>
        <div className="scroll-pb-24">
          <div className="pr-3">{tiles()}</div>
          {showAddButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 mb-10 w-full border-dashed border-slate-200 text-sky-700 hover:bg-sky-50/60"
              onClick={openCreateDefault}
            >
              <Plus className="mr-2 size-4 shrink-0" aria-hidden />
              Add appointment
            </Button>
          ) : null}
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
