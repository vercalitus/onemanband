"use client"

import { useMemo, useState } from "react"
import { CalendarPlus, ChevronLeft, ChevronRight, Clock3, EyeOff, Users } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"
import { MiniCalendar } from "@/features/calendar/components/mini-calendar"
import { Waitlist } from "@/features/calendar/components/waitlist"
import {
  CalendarViewToggle,
  type CalendarView,
} from "@/features/calendar/components/calendar-view-toggle"
import { WeekView } from "@/features/calendar/components/week-view"
import { MonthView } from "@/features/calendar/components/month-view"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import {
  darkCardHeaderClass,
  elevatedCardBodyClass,
  elevatedCardClass,
} from "@/lib/clinic-card-styles"
import { localeToBcp47 } from "@/lib/format-locale"
import type { Locale } from "@/lib/i18n/types"
import { toISODate, fromISODate } from "@/lib/date-helpers"
import { cn } from "@/lib/utils"

function formatHeader(view: CalendarView, value: Date, locale: Locale) {
  const tag = localeToBcp47(locale)
  if (view === "month") {
    return new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(value)
  }
  if (view === "week") {
    const start = new Date(value)
    start.setDate(value.getDate() - value.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const fmt = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric" })
    const yearFmt = new Intl.DateTimeFormat(tag, { year: "numeric" })
    return `${fmt.format(start)} – ${fmt.format(end)}, ${yearFmt.format(end)}`
  }
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value)
}

export default function CalendarPage() {
  const { locale, t } = useLocale()
  const { appointments, setAppointments, openCreateAppointment } = useScheduleDay()

  const [view, setView] = useState<CalendarView>("day")
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [showCanceled, setShowCanceled] = useState(false)

  const highlightDates = useMemo(() => {
    const seen = new Set<string>()
    const out: Date[] = []
    for (const a of appointments) {
      if (!a.date || seen.has(a.date)) continue
      seen.add(a.date)
      out.push(fromISODate(a.date))
    }
    return out
  }, [appointments])

  const goPrev = () => {
    const next = new Date(selected)
    if (view === "day") next.setDate(next.getDate() - 1)
    else if (view === "week") next.setDate(next.getDate() - 7)
    else next.setMonth(next.getMonth() - 1)
    setSelected(next)
  }
  const goNext = () => {
    const next = new Date(selected)
    if (view === "day") next.setDate(next.getDate() + 1)
    else if (view === "week") next.setDate(next.getDate() + 7)
    else next.setMonth(next.getMonth() + 1)
    setSelected(next)
  }
  const goToday = () => setSelected(new Date())

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className={cn("min-h-[560px]", elevatedCardClass)}>
        <CardHeader className={cn(darkCardHeaderClass, "gap-3")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock3 className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">{t("calendar.page.schedule")}</CardTitle>
            </div>
            <CalendarViewToggle value={view} onChange={setView} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label={t("calendar.page.back")}
                className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10"
              >
                {t("calendar.page.today")}
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label={t("calendar.page.next")}
                className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <p className="ms-2 text-sm font-semibold tracking-tight text-white/90">{formatHeader(view, selected, locale)}</p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={showCanceled}
                onChange={(e) => setShowCanceled(e.target.checked)}
                className="size-3.5 cursor-pointer accent-sky-400"
              />
              <span className="inline-flex items-center gap-1">
                <EyeOff className="size-3.5" aria-hidden />
                {t("calendar.page.showCanceled")}
              </span>
            </label>
          </div>
        </CardHeader>

        <CardContent className={cn(elevatedCardBodyClass, "pb-5")}>
          {view === "day" ? (
            <DayCalendarView
              appointments={appointments}
              onAppointmentsChange={setAppointments}
              selectedDate={selected}
              showCanceled={showCanceled}
              showAddButton={false}
              heightClassName="h-[min(70vh,560px)] md:h-[560px]"
            />
          ) : view === "week" ? (
            <WeekView
              appointments={appointments}
              onAppointmentsChange={setAppointments}
              value={selected}
              onSelectDate={setSelected}
              showCanceled={showCanceled}
            />
          ) : (
            <MonthView
              appointments={appointments}
              value={selected}
              onSelectDate={setSelected}
              showCanceled={showCanceled}
              onSwitchToDay={() => setView("day")}
            />
          )}
        </CardContent>
      </Card>

      <aside className="flex flex-col gap-5">
        <Card className={elevatedCardClass}>
          <CardContent className={cn(elevatedCardBodyClass, "space-y-3 py-5")}>
            <MiniCalendar value={selected} onChange={setSelected} highlightDates={highlightDates} />

            <div className="flex justify-center border-t border-slate-100 pt-4 pb-1">
              <button
                type="button"
                onClick={() => openCreateAppointment(toISODate(selected))}
                className="inline-flex items-center gap-1.5 px-0 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
                aria-label={t("calendar.page.addVisit")}
              >
                <span>{t("calendar.page.newAppointment")}</span>
                <CalendarPlus className="size-4 shrink-0 stroke-[2] text-sky-600" aria-hidden />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className={elevatedCardClass}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <Users className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-base font-bold tracking-tight text-white">{t("calendar.page.waitlist")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={cn(elevatedCardBodyClass, "py-4")}>
            <Waitlist />
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
