"use client"

import { useMemo } from "react"

import { useAppointmentTypeVisual } from "@/lib/use-appointment-type-visual"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "@/types/domain"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

/**
 * Six-row month grid. Each cell shows the day number, up to two appointment
 * chips, and a "+N more" counter. Clicking a cell drops the user back into the
 * day view for that date. Bucketing logic is shared with WeekView (mock data
 * = today only) and replaces transparently when appointments gain a `date`.
 */
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
  /** Called after a cell click so the parent can switch to Day view. */
  onSwitchToDay: () => void
}) {
  const typeVisual = useAppointmentTypeVisual()
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

  // Bucket appointments by their ISO date so each cell shows only its own day.
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const a of filtered) {
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    for (const [k, v] of map) map.set(k, sortByStart(v))
    return map
  }, [filtered])

  return (
    <div className="overflow-hidden rounded-lg">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400"
          >
            {d}
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
                "flex min-h-[92px] flex-col items-stretch gap-1 border-b border-r border-slate-100 p-1.5 text-left transition-colors hover:bg-sky-50/40",
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
                  const t = typeVisual[apt.appointmentType]
                  return (
                    <span
                      key={apt.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                        t.surface,
                        t.stripe.replace("border-l-4", "border-l-2"),
                      )}
                    >
                      <span className="font-mono tabular-nums">{apt.start}</span> {apt.patientName}
                    </span>
                  )
                })}
                {overflow > 0 ? (
                  <span className="text-[10px] font-medium text-slate-400">+{overflow} more</span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
