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
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          aria-label={t("calendar.mini.prevMonth")}
          className="flex size-11 items-center justify-center rounded-md text-mute transition-colors hover:bg-ground hover:text-ink"
        >
          <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
        <p className="text-[17px] font-bold text-ink">{monthTitleFmt.format(viewMonth)}</p>
        <button
          type="button"
          onClick={goNext}
          aria-label={t("calendar.mini.nextMonth")}
          className="flex size-11 items-center justify-center rounded-md text-mute transition-colors hover:bg-ground hover:text-ink"
        >
          <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-sm text-mute">
        {narrowWeekdays.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
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
                "relative flex h-11 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                inMonth ? "text-ink" : "text-faint",
                isSelected
                  ? "bg-cobalt font-bold text-white hover:bg-cobalt-hi"
                  : isToday
                    ? "font-bold text-cobalt ring-1 ring-inset ring-cobalt hover:bg-cobalt-tint"
                    : "hover:bg-ground",
              )}
              aria-pressed={isSelected}
              aria-label={d.toLocaleDateString(tag)}
            >
              {d.getDate()}
              {hasEvents && !isSelected ? (
                <span className="absolute bottom-1.5 size-1 rounded-full bg-mute" aria-hidden />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
