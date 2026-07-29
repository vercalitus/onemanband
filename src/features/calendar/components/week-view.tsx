"use client"

import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { useAppointmentTypeVisual } from "@/lib/use-appointment-type-visual"
import { hasOutstandingBalance } from "@/features/calendar/lib/payment-status"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { localizeScheduleRow } from "@/lib/i18n/localized-seed"
import { localeToBcp47 } from "@/lib/format-locale"
import type { AppointmentType, AppointmentStatus, ScheduleItem } from "@/types/domain"
import { cn } from "@/lib/utils"

const statusDot: Record<AppointmentStatus, string> = {
  confirmed: "bg-emerald-400",
  scheduled: "bg-sky-400",
  uncertain: "bg-amber-400",
  completed: "bg-slate-300",
  cancelled: "bg-rose-300",
  no_show: "bg-orange-300",
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  const dow = date.getDay()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - dow)
  return date
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

/** Seven-column week grid with localized labels and seeded row text when Hebrew is active. */
export function WeekView({
  appointments,
  onAppointmentsChange,
  value,
  onSelectDate,
  showCanceled,
}: {
  appointments: ScheduleItem[]
  onAppointmentsChange: (next: ScheduleItem[]) => void
  value: Date
  onSelectDate: (next: Date) => void
  showCanceled: boolean
}) {
  const { locale, t } = useLocale()
  const typeVisualBase = useAppointmentTypeVisual()
  const typeVisual = useMemo(() => {
    const next = { ...typeVisualBase }
    const keys: AppointmentType[] = ["first", "adjustments", "kupa"]
    for (const k of keys) next[k] = { ...next[k], label: t(`appt.type.${k}`) }
    return next
  }, [typeVisualBase, t])

  const dayLabelFmt = useMemo(
    () => new Intl.DateTimeFormat(localeToBcp47(locale), { weekday: "short" }),
    [locale],
  )
  const dayNumberFmt = useMemo(() => new Intl.DateTimeFormat(localeToBcp47(locale), { day: "numeric" }), [locale])

  const today = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => startOfWeek(value), [value])
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d
      }),
    [weekStart],
  )

  const filtered = useMemo(
    () => (showCanceled ? appointments : appointments.filter((a) => a.status !== "cancelled")),
    [appointments, showCanceled],
  )

  const localizedFiltered = useMemo(
    () => filtered.map((a) => localizeScheduleRow(a, locale)),
    [filtered, locale],
  )

  const cellsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const d of days) {
      const iso = toISODate(d)
      map.set(d.toDateString(), sortByStart(localizedFiltered.filter((a) => a.date === iso)))
    }
    return map
  }, [days, localizedFiltered])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeAppointment, setActiveAppointment] = useState<ScheduleItem | null>(null)

  return (
    <>
      <div className="grid grid-cols-7 border-b border-slate-100 text-center">
        {days.map((d) => {
          const isToday = isSameDay(d, today)
          const isSelected = isSameDay(d, value)
          return (
            <button
              key={d.toDateString()}
              type="button"
              onClick={() => onSelectDate(new Date(d))}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-medium transition-colors",
                isSelected ? "text-sky-700" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <span className="uppercase tracking-wider text-[10px] text-slate-400">{dayLabelFmt.format(d)}</span>
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday
                    ? "bg-sky-600 text-white"
                    : isSelected
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : "text-slate-700",
                )}
              >
                {dayNumberFmt.format(d)}
              </span>
            </button>
          )
        })}
      </div>

      <ScrollArea className="h-[min(70vh,560px)] md:h-[560px]">
        <div className="grid grid-cols-7 gap-3 p-3 md:gap-3.5 md:p-3.5">
          {days.map((d) => {
            const list = cellsByDay.get(d.toDateString()) ?? []
            return (
              <div key={d.toDateString()} className="flex min-h-[200px] flex-col gap-2 rounded-xl bg-slate-50/50 p-2 md:min-h-[220px] md:gap-2.5 md:p-2.5">
                {list.length === 0 ? (
                  <p className="my-auto px-1 text-center text-[11px] text-slate-300">{t("calendar.noVisits")}</p>
                ) : (
                  list.map((apt) => {
                    const tone = typeVisual[apt.appointmentType]
                    const debt = hasOutstandingBalance(apt.patientId)
                    const isCancelled = apt.status === "cancelled"
                    const canonical = appointments.find((a) => a.id === apt.id) ?? apt
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => {
                          setActiveAppointment(canonical)
                          setDialogOpen(true)
                        }}
                        className={cn(
                          "flex min-h-[68px] flex-col items-stretch gap-1 rounded-xl border px-2.5 py-2 text-start transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
                          tone.surface,
                          tone.stripe,
                          isCancelled && "opacity-60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "font-mono text-[11px] font-semibold text-slate-900 tabular-nums",
                              isCancelled && "line-through decoration-rose-400/70",
                            )}
                          >
                            {apt.start}
                          </span>
                          <span className="flex items-center gap-1">
                            <span
                              className={cn(
                                "size-1.5 rounded-full ring-1 ring-white",
                                debt ? "bg-rose-500" : "bg-emerald-500",
                              )}
                              aria-hidden
                              title={
                                debt ? t("dashboard.patient.debtTitle") : t("dashboard.patient.settledTitle")
                              }
                            />
                            <span className={cn("size-1.5 rounded-full", statusDot[apt.status])} aria-hidden />
                          </span>
                        </div>
                        <p className="line-clamp-1 text-[12px] font-semibold text-slate-900">{apt.patientName}</p>
                        <p className="line-clamp-1 text-[11px] text-slate-600">{apt.treatment}</p>
                      </button>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <AppointmentEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="edit"
        appointment={activeAppointment}
        allAppointments={appointments}
        onSave={(item, { isNew }) => {
          if (isNew) onAppointmentsChange(sortByStart([...appointments, item]))
          else onAppointmentsChange(sortByStart(appointments.map((a) => (a.id === item.id ? item : a))))
        }}
      />
    </>
  )
}
