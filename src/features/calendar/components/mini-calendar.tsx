"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { localeToBcp47 } from "@/lib/format-locale"
import { cn } from "@/lib/utils"

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Sidebar month picker — month title + narrow weekday row follow active locale. */
export function MiniCalendar({
  value,
  onChange,
  highlightDates,
}: {
  value: Date
  onChange: (next: Date) => void
  highlightDates?: Date[]
}) {
  const { locale, t } = useLocale()
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(value))
  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    setViewMonth(startOfMonth(value))
  }, [value])

  const tag = localeToBcp47(locale)
  const monthTitleFmt = useMemo(() => new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }), [tag])
  const narrowWeekdays = useMemo(() => {
    const ref = new Date(2024, 5, 2)
    const fmt = new Intl.DateTimeFormat(tag, { weekday: "narrow" })
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref)
      d.setDate(ref.getDate() + i)
      return fmt.format(d)
    })
  }, [tag])

  const cells = useMemo(() => {
    const first = startOfMonth(viewMonth)
    const startDow = first.getDay()
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - startDow)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [viewMonth])

  const highlightSet = useMemo(() => {
    const s = new Set<string>()
    highlightDates?.forEach((d) => s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`))
    return s
  }, [highlightDates])

  const goPrev = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const goNext = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          aria-label={t("calendar.mini.prevMonth")}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-sm font-semibold tracking-tight text-slate-900">{monthTitleFmt.format(viewMonth)}</p>
        <button
          type="button"
          onClick={goNext}
          aria-label={t("calendar.mini.nextMonth")}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {narrowWeekdays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const inMonth = d.getMonth() === viewMonth.getMonth()
          const isSelected = isSameDay(d, value)
          const isToday = isSameDay(d, today)
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const hasEvents = highlightSet.has(key)

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(new Date(d))}
              className={cn(
                "relative flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-colors",
                inMonth ? "text-slate-700" : "text-slate-300",
                isSelected
                  ? "bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                  : isToday
                    ? "ring-1 ring-inset ring-sky-300 text-sky-700 hover:bg-sky-50"
                    : "hover:bg-slate-100",
              )}
              aria-pressed={isSelected}
              aria-label={d.toLocaleDateString(tag)}
            >
              {d.getDate()}
              {hasEvents && !isSelected ? (
                <span className="absolute bottom-1 size-1 rounded-full bg-sky-400" aria-hidden />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
