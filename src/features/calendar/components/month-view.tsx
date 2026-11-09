"use client"

import { useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { StateMark, type MarkState } from "@/components/ui/state-mark"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { localizeScheduleRow } from "@/lib/i18n/localized-seed"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"
import { cn } from "@/lib/utils"

const WEEK_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

/** Each status in the one vocabulary (DESIGN.md) — the same mapping the day and week views use. */
const STATUS_MARK: Record<AppointmentStatus, MarkState> = {
  confirmed: "plan",
  scheduled: "plan",
  uncertain: "unsure",
  completed: "done",
  cancelled: "cancel",
  no_show: "cancel",
}

/** How many visits a day cell lists before it says "+n more". */
const PREVIEW = 2

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

/** Month grid on paper: hairline cells, each listing its first visits in the state vocabulary. */
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

  // Client clock only: the server renders in UTC and would disagree about "today".
  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => setToday(new Date()), [])
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-14 shrink-0 grid-cols-7 border-b border-hair">
        {WEEK_KEYS.map((wk) => (
          <div key={wk} className="flex items-center border-s border-hair-soft px-3 text-sm text-mute first:border-s-0">
            {t(`calendar.week.short.${wk}`)}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((d) => {
          const inMonth = d.getMonth() === monthStart.getMonth()
          const isSelected = isSameDay(d, value)
          const isToday = today ? isSameDay(d, today) : false
          const dayList = byDate.get(toISODate(d)) ?? []
          const preview = dayList.slice(0, PREVIEW)
          const overflow = dayList.length - preview.length

          return (
            <button
              key={d.toDateString()}
              type="button"
              onClick={() => {
                onSelectDate(new Date(d))
                onSwitchToDay()
              }}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-24 min-w-0 flex-col items-stretch gap-1 overflow-hidden border-s border-b border-hair-soft p-2 text-start transition-colors hover:bg-ground focus-visible:z-10 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-cobalt [&:nth-child(7n+1)]:border-s-0",
                !inMonth && "bg-ground/60",
                isSelected && "bg-cobalt-tint hover:bg-cobalt-tint",
                isToday && !isSelected && "bg-cobalt/[0.035]",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[17px] leading-6 tabular-nums",
                  isToday ? "font-bold text-cobalt" : inMonth ? "font-medium text-ink" : "text-faint",
                )}
              >
                {isToday && <span className="size-2.5 shrink-0 rounded-full bg-signal" aria-hidden />}
                {d.getDate()}
              </span>
              {preview.map((apt) => {
                const mark = STATUS_MARK[apt.status]
                return (
                  <span
                    key={apt.id}
                    className={cn(
                      "flex min-w-0 items-center gap-1.5 text-sm leading-[18px]",
                      inMonth ? "text-ink" : "text-mute",
                    )}
                  >
                    <StateMark state={mark} className="size-2.5" />
                    <span className="shrink-0 tabular-nums text-mute">{apt.start}</span>
                    <span className={cn("truncate", mark === "cancel" && "text-mute line-through")}>
                      {apt.patientName}
                    </span>
                  </span>
                )
              })}
              {overflow > 0 ? (
                <span className="text-sm text-mute">{t("calendar.moreSuffix", { count: overflow })}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
