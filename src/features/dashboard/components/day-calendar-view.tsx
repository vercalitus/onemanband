"use client"

import { useState } from "react"
import Link from "next/link"
import { FolderOpen } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { HoverTip } from "@/components/ui/tooltip"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { appointmentTypeVisual } from "@/lib/appointment-types"
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  minutesFromHHMM,
  snapMinutesToSlotNearest,
} from "@/lib/appointment-time"

const HOUR_HEIGHT = 120
const HOUR_START = CALENDAR_HOUR_START
const HOUR_END = CALENDAR_HOUR_END

const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT
const pxPerMin = HOUR_HEIGHT / 60

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

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

export function DayCalendarView({
  appointments,
  onAppointmentsChange,
}: {
  appointments: ScheduleItem[]
  onAppointmentsChange: (next: ScheduleItem[]) => void
}) {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = (currentMinutes - HOUR_START * 60) * pxPerMin
  const showNowLine = currentMinutes >= HOUR_START * 60 && currentMinutes < HOUR_END * 60

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

  const openCreateAt = (startMinFromClick: number) => {
    const snapped = snapMinutesToSlotNearest(startMinFromClick)
    const clamped = Math.min(Math.max(snapped, HOUR_START * 60), HOUR_END * 60 - 5)
    setDialogMode("create")
    setActiveAppointment(null)
    setDefaultStartMinutes(clamped)
    setDialogOpen(true)
  }

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const rawMin = HOUR_START * 60 + y / pxPerMin
    openCreateAt(rawMin)
  }

  return (
    <>
      <ScrollArea className="h-[460px]">
        <div className="flex select-none gap-0 pb-4 pr-2">
          <div className="w-14 shrink-0" style={{ height: totalHeight }}>
            {hours.map((h) => (
              <div key={h} className="flex items-start justify-end pr-3" style={{ height: HOUR_HEIGHT }}>
                <span className="-mt-[0.55em] font-mono text-[11px] tabular-nums text-slate-400">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          <div
            role="presentation"
            className="relative flex-1 cursor-crosshair"
            style={{ height: totalHeight }}
            onClick={handleGridClick}
          >
            {hours.map((h) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                style={{ top: (h - HOUR_START) * HOUR_HEIGHT }}
              />
            ))}

            {hours.map((h) => (
              <div
                key={`${h}-half`}
                className="pointer-events-none absolute inset-x-0 border-t border-slate-50"
                style={{ top: (h - HOUR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {hours.map((h) => (
              <div key={`${h}-q1`}>
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-slate-100/70"
                  style={{ top: (h - HOUR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 4 }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-slate-100/70"
                  style={{ top: (h - HOUR_START) * HOUR_HEIGHT + (3 * HOUR_HEIGHT) / 4 }}
                />
              </div>
            ))}

            {showNowLine && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-1.5"
                style={{ top: nowOffset }}
              >
                <span className="size-2 shrink-0 rounded-full bg-sky-500" />
                <div className="h-px flex-1 bg-sky-400" />
              </div>
            )}

            {appointments.map((apt) => {
              const startMin = minutesFromHHMM(apt.start)
              const endMin = minutesFromHHMM(apt.end)
              const offsetMin = startMin - HOUR_START * 60
              const durationMin = endMin - startMin

              const top = offsetMin * pxPerMin
              const height = durationMin * pxPerMin
              const style = statusStyle[apt.status]
              const typeStyle = appointmentTypeVisual[apt.appointmentType]
              const tip = `${apt.patientName} · ${typeStyle.label} · ${apt.start}–${apt.end} · ${apt.treatment}`

              const layout =
                height >= 48 ? "full" : height >= 22 ? "medium" : ("compact" as const)

              return (
                <div
                  key={apt.id}
                  role="button"
                  tabIndex={0}
                  className={`absolute left-1 right-2 cursor-pointer overflow-hidden rounded-xl border px-2 transition-shadow hover:z-20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none ${style.card} ${typeStyle.stripe}`}
                  style={{ top, height: Math.max(height, 10), paddingTop: 2, paddingBottom: 2 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(apt)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openEdit(apt)
                    }
                  }}
                >
                  {layout === "full" && (
                    <div className="flex h-full flex-col justify-between gap-0.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className={`mt-0.5 size-1.5 shrink-0 rounded-full ${style.dot}`} />
                          <p className="truncate text-sm font-semibold text-slate-800">{apt.patientName}</p>
                          <Link
                            href={`/patients/${apt.patientId}?tab=records`}
                            className="ml-0.5 shrink-0 text-slate-400 hover:text-slate-600"
                            title="Medical records"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FolderOpen className="size-3.5" />
                          </Link>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${typeStyle.chip}`}>
                            {typeStyle.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="min-w-0 truncate text-[11px] text-slate-500">{apt.treatment}</p>
                        <p className="shrink-0 font-mono text-[10px] text-slate-400 tabular-nums">
                          {apt.start}–{apt.end}
                        </p>
                      </div>
                    </div>
                  )}

                  {layout === "medium" && (
                    <div className="flex h-full items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
                        <p className="truncate text-[11px] font-semibold text-slate-800">{apt.patientName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium ${typeStyle.chip}`}>
                        {typeStyle.label}
                      </span>
                      <p className="shrink-0 font-mono text-[9px] text-slate-400 tabular-nums">
                        {apt.start}
                      </p>
                    </div>
                  )}

                  {layout === "compact" && (
                    <HoverTip tip={tip}>
                      <div className="flex h-full items-center gap-1 overflow-hidden">
                        <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
                        <span className="font-mono text-[9px] font-semibold text-slate-700 tabular-nums">
                          {getInitials(apt.patientName)}
                        </span>
                        <span className={`truncate rounded px-1 py-px text-[8px] font-medium ${typeStyle.chip}`}>
                          {typeStyle.label}
                        </span>
                      </div>
                    </HoverTip>
                  )}
                </div>
              )
            })}
          </div>
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
