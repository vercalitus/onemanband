"use client"

import { useMemo } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useAppointmentTypeVisual } from "@/lib/use-appointment-type-visual"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { localizeScheduleRow } from "@/lib/i18n/localized-seed"
import type { AppointmentType, ScheduleItem } from "@/types/domain"
import { cn } from "@/lib/utils"

const WEEK_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

/** Month grid — weekday headers + localized appointment chips when locale is Hebrew. */
export function MonthView({
  appointments,
  value,
  onSelectDate,
  showCanceled,
  onSwitchToDay,
}: {
  appointments: ScheduleItem[]
  value: Date
  onSelectDate: (next: Date) => void
  showCanceled: boolean
  onSwitchToDay: () => void
}) {
  const { locale, t } = useLocale()
  const typeVisualBase = useAppointmentTypeVisual()
  const typeVisual = useMemo(() => {
    const next = { ...typeVisualBase }
    const keys: AppointmentType[] = ["first", "adjustments", "kupa"]
    for (const k of keys) next[k] = { ...next[k], label: t(`appt.type.${k}`) }
    return next
  }, [typeVisualBase, t])

  const today = useMemo(() => new Date(), [])
  const monthStart = useMemo(() => startOfMonth(value), [value])

  const cells = useMemo(() => {
    const first = monthStart
    const startDow = first.getDay()
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - startDow)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [monthStart])

  const filtered = useMemo(
    () => (showCanceled ? appointments : appointments.filter((a) => a.status !== "cancelled")),
    [appointments, showCanceled],
  )

  const localizedFiltered = useMemo(
    () => filtered.map((a) => localizeScheduleRow(a, locale)),
    [filtered, locale],
  )

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const a of localizedFiltered) {
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    for (const [k, v] of map) map.set(k, sortByStart(v))
    return map
  }, [localizedFiltered])

  return (
    <div className="overflow-hidden rounded-lg">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {WEEK_KEYS.map((wk) => (
          <div
            key={wk}
            className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400"
          >
            {t(`calendar.week.short.${wk}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d) => {
          const inMonth = d.getMonth() === monthStart.getMonth()
          const isSelected = isSameDay(d, value)
          const isToday = isSameDay(d, today)
          const dayList = byDate.get(toISODate(d)) ?? []
          const preview = dayList.slice(0, 2)
          const overflow = dayList.length - preview.length

          return (
            <button
              key={d.toDateString()}
              type="button"
              onClick={() => {
                onSelectDate(new Date(d))
                onSwitchToDay()
              }}
              className={cn(
                "flex min-h-[100px] flex-col items-stretch gap-1.5 border-b border-e border-slate-100 p-2 text-start transition-colors hover:bg-sky-50/40",
                !inMonth && "bg-slate-50/30 text-slate-300",
                isSelected && "bg-sky-50/60",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday
                      ? "bg-sky-600 text-white"
                      : isSelected
                        ? "text-sky-700"
                        : inMonth
                          ? "text-slate-700"
                          : "text-slate-300",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {preview.map((apt) => {
                  const tone = typeVisual[apt.appointmentType]
                  return (
                    <span
                      key={apt.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                        tone.surface,
                        tone.stripe.replace("border-l-4", "border-l-2"),
                      )}
                    >
                      <span className="font-mono tabular-nums">{apt.start}</span> {apt.patientName}
                    </span>
                  )
                })}
                {overflow > 0 ? (
                  <span className="text-[10px] font-medium text-slate-400">
                    {t("calendar.moreSuffix", { count: overflow })}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
