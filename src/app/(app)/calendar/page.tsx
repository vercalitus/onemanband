"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { PagePlate, PlateDivider, PlateFact, PlateSpacer } from "@/components/layout/page-plate"
import { Button } from "@/components/ui/button"
import { StateLegend } from "@/components/ui/state-mark"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"
import { MiniCalendar } from "@/features/calendar/components/mini-calendar"
import { Waitlist } from "@/features/calendar/components/waitlist"
import {
  CalendarViewToggle,
  type CalendarView,
} from "@/features/calendar/components/calendar-view-toggle"
import { WeekView, visibleWeekDays } from "@/features/calendar/components/week-view"
import { MonthView } from "@/features/calendar/components/month-view"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"
import { localeToBcp47 } from "@/lib/format-locale"
import { toISODate, fromISODate } from "@/lib/date-helpers"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "@/types/domain"

/** The dates a view covers, first and last inclusive. */
function periodOf(view: CalendarView, value: Date, weekDays: Date[]) {
  if (view === "day") return { from: value, to: value }
  if (view === "week") return { from: weekDays[0], to: weekDays[weekDays.length - 1] }
  return {
    from: new Date(value.getFullYear(), value.getMonth(), 1),
    to: new Date(value.getFullYear(), value.getMonth() + 1, 0),
  }
}

/** What the plate says about the period: a small label above, the period itself in display type. */
function periodHeading(view: CalendarView, from: Date, to: Date, tag: string) {
  if (view === "month") {
    return {
      label: new Intl.DateTimeFormat(tag, { year: "numeric" }).format(from),
      display: new Intl.DateTimeFormat(tag, { month: "long" }).format(from),
    }
  }
  if (view === "week") {
    return {
      label: new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).formatRange(from, to),
      display: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).formatRange(from, to),
    }
  }
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "long" }).format(from)
  const monthYear = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(from)
  return {
    label: `${weekday} · ${monthYear}`,
    display: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(from),
  }
}

/** On the cobalt plate: transparent, a white hairline, white text. */
const PLATE_BUTTON =
  "inline-flex h-12 shrink-0 items-center justify-center rounded-md border border-white/25 text-[17px] font-medium text-white transition-colors hover:bg-white/10"

export default function CalendarPage() {
  const { locale, t } = useLocale()
  const { appointments, openCreateAppointment } = useScheduleDay()
  const { settings } = useClinicSettings()

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

  const weekDays = useMemo(
    () => visibleWeekDays(selected, settings.weekdays, appointments),
    [selected, settings.weekdays, appointments],
  )
  const period = useMemo(() => periodOf(view, selected, weekDays), [view, selected, weekDays])
  const heading = useMemo(
    () => periodHeading(view, period.from, period.to, localeToBcp47(locale)),
    [view, period, locale],
  )

  /** Visits in the period on screen. A cancelled booking is not a visit. */
  const visitCount = useMemo(() => {
    const from = toISODate(period.from)
    const to = toISODate(period.to)
    return appointments.filter((a: ScheduleItem) => a.status !== "cancelled" && a.date >= from && a.date <= to).length
  }, [appointments, period])

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
    <>
      <PagePlate>
        <PlateFact label={heading.label} display className="min-w-[8ch]">
          <span suppressHydrationWarning>{heading.display}</span>
        </PlateFact>
        <PlateDivider />
        <CalendarViewToggle value={view} onChange={setView} />
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={goPrev} aria-label={t("calendar.page.back")} className={cn(PLATE_BUTTON, "w-12")}>
            <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" onClick={goToday} className={cn(PLATE_BUTTON, "px-4")}>
            {t("calendar.page.today")}
          </button>
          <button type="button" onClick={goNext} aria-label={t("calendar.page.next")} className={cn(PLATE_BUTTON, "w-12")}>
            <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
        <PlateSpacer />
        <PlateFact label={t("calendar.plate.visits")}>{visitCount}</PlateFact>
        <Button
          type="button"
          className="h-14 px-5"
          onClick={() => openCreateAppointment(toISODate(selected))}
        >
          <Plus className="size-5" aria-hidden />
          {t("calendar.page.addVisit")}
        </Button>
      </PagePlate>

      <div className="grid overflow-hidden rounded-md border border-hair bg-paper lg:h-[calc(100dvh-11.5rem)] lg:min-h-[520px] lg:grid-cols-[minmax(0,1fr)_336px]">
        <section className="flex min-h-0 min-w-0 flex-col" aria-label={t(`calendar.view.${view}`)}>
          {view === "day" ? (
            <div className="min-h-0 flex-1">
              <DayCalendarView
                appointments={appointments}
                selectedDate={selected}
                showCanceled={showCanceled}
                showAddButton={false}
                heightClassName="h-[min(72dvh,640px)] lg:h-full"
              />
            </div>
          ) : view === "week" ? (
            <WeekView
              appointments={appointments}
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
        </section>

        <aside className="grid min-h-0 content-start border-t border-hair md:grid-cols-2 lg:flex lg:flex-col lg:overflow-y-auto lg:border-t-0 lg:border-s">
          <div className="border-hair px-3 pt-2 pb-3 md:border-e lg:border-e-0 lg:border-b">
            <MiniCalendar value={selected} onChange={setSelected} highlightDates={highlightDates} />
          </div>

          <div className="flex min-w-0 flex-col lg:flex-1">
            <Waitlist bookDate={toISODate(selected)} />

            <div className="mt-auto grid gap-3 px-5 py-4">
              <StateLegend
                className="grid grid-cols-2"
                items={[
                  { state: "done", label: t("appt.status.completed") },
                  { state: "plan", label: t("appt.status.scheduled") },
                  { state: "unsure", label: t("appt.status.uncertain") },
                  { state: "cancel", label: t("appt.status.cancelled") },
                ]}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={showCanceled}
                onClick={() => setShowCanceled((v) => !v)}
                className="h-11 justify-self-start"
              >
                {t("calendar.page.showCanceled")}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
