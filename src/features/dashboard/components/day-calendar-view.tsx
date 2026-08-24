"use client"

import Link from "next/link"
import { FolderOpen, Plus } from "lucide-react"
import { type ReactNode, useCallback, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AppointmentStatus, AppointmentType, ScheduleItem } from "@/types/domain"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { useAppointmentAutomations } from "@/features/automations/lib/use-appointment-automations"
import { useAppointmentTypeVisual } from "@/lib/use-appointment-type-visual"
import { hasOutstandingBalance } from "@/features/calendar/lib/payment-status"
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  clampStartForDuration,
  minutesFromHHMM,
  snapMinutesToSlotNearest,
} from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { localizeScheduleRow } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"

const DAY_START_MIN = CALENDAR_HOUR_START * 60
const DAY_END_MIN = CALENDAR_HOUR_END * 60

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

function hourOf(hhmm: string): number {
  return Math.floor(minutesFromHHMM(hhmm) / 60)
}

function NowDivider({ label, aria }: { label: string; aria: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5" role="separator" aria-label={aria}>
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-600">
        {label}
      </span>
      <div className="h-px min-w-0 flex-1 bg-sky-400" />
      <span className="size-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
    </div>
  )
}

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
  selectedDate,
  showCanceled = true,
  showAddButton = true,
  heightClassName = "h-[min(70vh,520px)] md:h-[500px]",
}: {
  appointments: ScheduleItem[]
  onAppointmentsChange: (next: ScheduleItem[]) => void
  selectedDate?: Date
  showCanceled?: boolean
  showAddButton?: boolean
  heightClassName?: string
}) {
  const { locale, t } = useLocale()
  const typeVisualBase = useAppointmentTypeVisual()

  const typeVisual = useMemo(() => {
    const types: AppointmentType[] = ["first", "adjustments", "kupa"]
    const out = { ...typeVisualBase }
    for (const k of types) {
      out[k] = { ...out[k], label: t(`appt.type.${k}`) }
    }
    return out
  }, [typeVisualBase, t])

  const statusTone = useMemo(
    (): Record<AppointmentStatus, { dot: string; label: string; text: string }> => ({
      confirmed: { dot: "bg-emerald-400", label: t("appt.status.confirmed"), text: "text-emerald-700" },
      scheduled: { dot: "bg-sky-400", label: t("appt.status.scheduled"), text: "text-sky-700" },
      uncertain: { dot: "bg-amber-400", label: t("appt.status.uncertain"), text: "text-amber-700" },
      completed: { dot: "bg-slate-300", label: t("appt.status.completed"), text: "text-slate-500" },
      cancelled: { dot: "bg-rose-300", label: t("appt.status.cancelled"), text: "text-rose-500" },
      no_show: { dot: "bg-orange-300", label: t("appt.status.no_show"), text: "text-orange-600" },
    }),
    [t],
  )

  const localized = useMemo(
    () => appointments.map((a) => localizeScheduleRow(a, locale)),
    [appointments, locale],
  )

  const effectiveISO = useMemo(() => toISODate(selectedDate ?? new Date()), [selectedDate])
  const todayISO = toISODate(new Date())
  const isViewingToday = effectiveISO === todayISO

  const visible = useMemo(() => {
    const sameDay = localized.filter((a) => a.date === effectiveISO)
    const list = showCanceled ? sameDay : sameDay.filter((a) => a.status !== "cancelled")
    return sortByStart(list)
  }, [localized, effectiveISO, showCanceled])

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const showNowLine = isViewingToday && currentMinutes >= DAY_START_MIN && currentMinutes < DAY_END_MIN

  const resolveCanonical = useCallback(
    (row: ScheduleItem) => appointments.find((a) => a.id === row.id) ?? row,
    [appointments],
  )

  const syncAutomations = useAppointmentAutomations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("edit")
  const [activeAppointment, setActiveAppointment] = useState<ScheduleItem | null>(null)
  const [defaultStartMinutes, setDefaultStartMinutes] = useState<number | undefined>(undefined)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)

  const openEdit = useCallback(
    (displayRow: ScheduleItem) => {
      const apt = resolveCanonical(displayRow)
      setDialogMode("edit")
      setActiveAppointment(apt)
      setDefaultStartMinutes(undefined)
      setDefaultDate(undefined)
      setDialogOpen(true)
    },
    [resolveCanonical],
  )

  const openCreateDefault = () => {
    const defaultDuration = 15
    const baseMinutes = isViewingToday ? currentMinutes : DAY_START_MIN + 60
    const snapped = snapMinutesToSlotNearest(baseMinutes)
    const clamped = clampStartForDuration(snapped, defaultDuration)
    setDialogMode("create")
    setActiveAppointment(null)
    setDefaultStartMinutes(clamped)
    setDefaultDate(effectiveISO)
    setDialogOpen(true)
  }

  const renderTiles = () => {
    let markerPlaced = false
    let prevEnd: number | null = null
    let prevHour: number | null = null
    const nodes: ReactNode[] = []
    const nowLabel = t("dashboard.timeline.now")

    visible.forEach((apt, idx) => {
      const startMin = minutesFromHHMM(apt.start)
      const endMin = minutesFromHHMM(apt.end)
      const startHour = hourOf(apt.start)

      if (showNowLine && !markerPlaced) {
        const gapStart = prevEnd ?? DAY_START_MIN
        if (currentMinutes >= gapStart && currentMinutes < startMin) {
          nodes.push(<NowDivider key={`now-gap-${apt.id}`} label={nowLabel} aria={nowLabel} />)
          markerPlaced = true
        }
      }

      if (showNowLine && !markerPlaced && currentMinutes >= startMin && currentMinutes < endMin) {
        nodes.push(<NowDivider key={`now-in-${apt.id}`} label={nowLabel} aria={nowLabel} />)
        markerPlaced = true
      }

      if (idx > 0 && prevHour !== null && startHour !== prevHour) {
        nodes.push(<HourDivider key={`hour-${apt.id}`} hour={startHour} />)
      }

      const status = statusTone[apt.status]
      const typeStyle = typeVisual[apt.appointmentType]
      const isCancelled = apt.status === "cancelled"
      const debt = hasOutstandingBalance(apt.patientId)

      nodes.push(
        <div
          key={apt.id}
          role="button"
          tabIndex={0}
          className={cn(
            "mb-2 flex min-h-[96px] cursor-pointer gap-3 overflow-hidden rounded-xl border px-3 py-3 pe-4 transition-shadow focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
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
            title={debt ? t("dashboard.patient.debtTitle") : t("dashboard.patient.settledTitle")}
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
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider",
                    status.text,
                  )}
                >
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
                title={t("dashboard.patient.recordsLink")}
                onClick={(e) => e.stopPropagation()}
              >
                <FolderOpen className="size-4 stroke-[1.6]" aria-hidden />
                <span className="sr-only">{t("dashboard.patient.openChart", { name: apt.patientName })}</span>
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
      nodes.push(<NowDivider key="now-trailing" label={nowLabel} aria={nowLabel} />)
    }

    if (nodes.length === 0) {
      nodes.push(
        <p
          key="empty"
          className="my-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400"
        >
          {t("dashboard.day.empty")}
        </p>,
      )
    }

    return nodes
  }

  return (
    <>
      <ScrollArea className={heightClassName}>
        <div className="scroll-pb-24">
          <div className="pr-3">{renderTiles()}</div>
          {showAddButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 mb-10 w-full border-dashed border-slate-200 text-sky-700 hover:bg-sky-50/60"
              onClick={openCreateDefault}
            >
              <Plus className="me-2 size-4 shrink-0" aria-hidden />
              {t("dashboard.day.addAppointment")}
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
        defaultDate={defaultDate}
        allAppointments={appointments}
        onSave={(item, { isNew }) => {
          const previous = appointments.find((a) => a.id === item.id) ?? null
          if (isNew) onAppointmentsChange(sortByStart([...appointments, item]))
          else onAppointmentsChange(sortByStart(appointments.map((a) => (a.id === item.id ? item : a))))
          syncAutomations(item, { isNew, previous })
        }}
      />
    </>
  )
}
