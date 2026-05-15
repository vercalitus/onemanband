"use client"

import { useMemo, useState } from "react"
import { CalendarPlus, ChevronLeft, ChevronRight, Clock3, EyeOff, Users } from "lucide-react"

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
import { cn } from "@/lib/utils"

/**
 * Format the title shown above the schedule grid. Day view shows full date,
 * Week view shows the bracketing dates of the week, Month view shows the
 * month label — keeping the header useful for whichever view is active.
 */
function formatHeader(view: CalendarView, value: Date) {
  if (view === "month") {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(value)
  }
  if (view === "week") {
    const start = new Date(value)
    start.setDate(value.getDate() - value.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
    const yearFmt = new Intl.DateTimeFormat(undefined, { year: "numeric" })
    return `${fmt.format(start)} – ${fmt.format(end)}, ${yearFmt.format(end)}`
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value)
}

export default function CalendarPage() {
  const { appointments, setAppointments, openCreateAppointment } = useScheduleDay()

  const [view, setView] = useState<CalendarView>("day")
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [showCanceled, setShowCanceled] = useState(false)

  // Dates that should show a dot in the mini-calendar (today only for now,
  // since mock appointments aren't dated). Cheap to memoize defensively.
  const highlightDates = useMemo(() => [new Date()], [])

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
              <CardTitle className="text-xl font-bold tracking-tight text-white">Schedule</CardTitle>
            </div>
            <CalendarViewToggle value={view} onChange={setView} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous"
                className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next"
                className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <p className="ml-2 text-sm font-semibold tracking-tight text-white/90">{formatHeader(view, selected)}</p>
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
                Show canceled
              </span>
            </label>
          </div>
        </CardHeader>

        <CardContent className={cn(elevatedCardBodyClass, "pb-5")}>
          {view === "day" ? (
            <DayCalendarView
              appointments={appointments}
              onAppointmentsChange={setAppointments}
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
          <CardContent className={cn(elevatedCardBodyClass, "space-y-4 py-5")}>
            <button
              type="button"
              onClick={openCreateAppointment}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
            >
              <CalendarPlus className="size-4 shrink-0" aria-hidden />
              New Appointment
            </button>

            <MiniCalendar value={selected} onChange={setSelected} highlightDates={highlightDates} />
          </CardContent>
        </Card>

        <Card className={elevatedCardClass}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <Users className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-base font-bold tracking-tight text-white">Waitlist</CardTitle>
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
