"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import type { MarkState } from "@/components/ui/state-mark"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { useOutstandingBalances } from "@/features/calendar/lib/payment-status"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"
import { CALENDAR_HOUR_END, CALENDAR_HOUR_START, minutesFromHHMM } from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { localizeScheduleRow } from "@/lib/i18n/localized-seed"
import { localeToBcp47 } from "@/lib/format-locale"
import type { AppointmentStatus, ScheduleItem } from "@/types/domain"
import type { WeekdayScheduleSlot } from "@/types/clinic-settings"
import { cn } from "@/lib/utils"

/** Height of one hour on the grid. A 15-minute visit is 20px: one line of text. */
const HOUR_PX = 80
const PX_PER_MIN = HOUR_PX / 60
const GRID_START_MIN = CALENDAR_HOUR_START * 60
const GRID_END_MIN = CALENDAR_HOUR_END * 60
const GRID_HEIGHT = (GRID_END_MIN - GRID_START_MIN) * PX_PER_MIN
const HOURS = Array.from({ length: CALENDAR_HOUR_END - CALENDAR_HOUR_START }, (_, i) => CALENDAR_HOUR_START + i)

/** Closed hours, hatched the way the day view draws them. */
const HATCH = "repeating-linear-gradient(-45deg, var(--color-ground) 0 7px, var(--color-sunk) 7px 8px)"

/** Each status in the one vocabulary (DESIGN.md) — the same mapping the day view uses. */
const STATUS_MARK: Record<AppointmentStatus, MarkState> = {
  confirmed: "plan",
  scheduled: "plan",
  uncertain: "unsure",
  completed: "done",
  cancelled: "cancel",
  no_show: "cancel",
}

export function startOfWeek(d: Date) {
  const date = new Date(d)
  const dow = date.getDay()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - dow)
  return date
}

/** Settings count weekdays from Monday (0) to Sunday (6); `Date#getDay` from Sunday. */
function openingFor(d: Date, weekdays: WeekdayScheduleSlot[]) {
  const idx = (d.getDay() + 6) % 7
  return weekdays.find((w) => w.weekdayIndex === idx)
}

/**
 * The days the week grid draws: every day the clinic opens, plus any closed day
 * that nonetheless holds a visit — a booking is never hidden by the hours.
 * Exported so the plate states the same range the grid shows.
 */
export function visibleWeekDays(value: Date, weekdays: WeekdayScheduleSlot[], appointments: ScheduleItem[]) {
  const start = startOfWeek(value)
  const all = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const booked = new Set(appointments.filter((a) => a.status !== "cancelled").map((a) => a.date))
  const shown = all.filter((d) => openingFor(d, weekdays)?.open !== false || booked.has(toISODate(d)))
  return shown.length ? shown : all
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

const clampToGrid = (m: number) => Math.min(GRID_END_MIN, Math.max(GRID_START_MIN, m))
const topOf = (m: number) => (clampToGrid(m) - GRID_START_MIN) * PX_PER_MIN

/** Week as an hour grid: bookings at their real length, in the state vocabulary. */
export function WeekView({
  appointments,
  value,
  onSelectDate,
  showCanceled,
}: {
  appointments: ScheduleItem[]
  value: Date
  onSelectDate: (next: Date) => void
  showCanceled: boolean
}) {
  const { locale, t } = useLocale()
  const owing = useOutstandingBalances()
  const { commitAppointment } = useScheduleDay()
  const { settings } = useClinicSettings()

  const dayLabelFmt = useMemo(
    () => new Intl.DateTimeFormat(localeToBcp47(locale), { weekday: "short" }),
    [locale],
  )
  const dayNumberFmt = useMemo(() => new Intl.DateTimeFormat(localeToBcp47(locale), { day: "numeric" }), [locale])

  // The clock, for today's column and the now-line. Ticks once a minute.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : null

  const days = useMemo(
    () => visibleWeekDays(value, settings.weekdays, appointments),
    [value, settings.weekdays, appointments],
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

  /** The visit in progress, or else the next one still to come today: drawn in cobalt. */
  const nextId = useMemo(() => {
    if (!now || nowMinutes === null) return null
    const todays = localizedFiltered.filter(
      (a) =>
        a.date === toISODate(now) &&
        a.status !== "cancelled" &&
        a.status !== "completed" &&
        a.status !== "no_show",
    )
    const current = todays.find((a) => minutesFromHHMM(a.start) <= nowMinutes && nowMinutes < minutesFromHHMM(a.end))
    const next = sortByStart(todays).find((a) => minutesFromHHMM(a.start) >= nowMinutes)
    return (current ?? next)?.id ?? null
  }, [localizedFiltered, now, nowMinutes])

  // Open on the working day rather than the empty early hours.
  const scrollRef = useRef<HTMLDivElement>(null)
  const weekKey = days.length ? toISODate(days[0]) : ""
  const clockReady = now !== null
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const anchor = nowMinutes !== null && nowMinutes > GRID_START_MIN + 120 ? nowMinutes - 90 : GRID_START_MIN
    el.scrollTop = topOf(anchor)
    // Only on first paint of a week; re-scrolling on every tick would fight the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, clockReady])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeAppointment, setActiveAppointment] = useState<ScheduleItem | null>(null)

  const columns = `56px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-14 shrink-0 border-b border-hair" style={{ gridTemplateColumns: columns }}>
        <div aria-hidden />
        {days.map((d) => {
          const isToday = now ? isSameDay(d, now) : false
          const isSelected = isSameDay(d, value)
          const isPast = now ? d < new Date(now.getFullYear(), now.getMonth(), now.getDate()) : false
          return (
            <button
              key={d.toDateString()}
              type="button"
              onClick={() => onSelectDate(new Date(d))}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "-mb-px flex min-h-14 min-w-0 items-center gap-1.5 border-b-2 border-s border-s-hair-soft px-2 text-sm transition-colors hover:bg-ground sm:px-3",
                isSelected ? "border-b-cobalt" : "border-b-transparent",
                isToday ? "font-bold text-cobalt" : "text-mute",
              )}
            >
              {isToday && <span className="size-2.5 shrink-0 rounded-full bg-signal" aria-hidden />}
              <span className="truncate">{dayLabelFmt.format(d)}</span>
              <span
                className={cn(
                  "text-[22px] leading-none tabular-nums",
                  isToday ? "font-bold text-cobalt" : isPast ? "font-medium text-mute" : "font-medium text-ink",
                )}
              >
                {dayNumberFmt.format(d)}
              </span>
            </button>
          )
        })}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="relative grid" style={{ gridTemplateColumns: columns, height: GRID_HEIGHT }}>
          {/* Hour and half-hour hairlines, under everything. */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {HOURS.map((h) => (
              <div key={h}>
                <div className="absolute inset-x-0 border-t border-hair" style={{ top: (h * 60 - GRID_START_MIN) * PX_PER_MIN }} />
                <div
                  className="absolute inset-x-0 border-t border-hair-soft"
                  style={{ top: (h * 60 + 30 - GRID_START_MIN) * PX_PER_MIN }}
                />
              </div>
            ))}
          </div>

          <div className="relative" aria-hidden>
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute end-2 -translate-y-1/2 bg-paper px-0.5 text-sm tabular-nums text-mute"
                style={{ top: (h * 60 - GRID_START_MIN) * PX_PER_MIN }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {days.map((d) => {
            const list = cellsByDay.get(d.toDateString()) ?? []
            const isToday = now ? isSameDay(d, now) : false
            const opening = openingFor(d, settings.weekdays)
            const closedAllDay = opening?.open === false
            const openMin = opening && !closedAllDay ? minutesFromHHMM(opening.openTime) : GRID_START_MIN
            const closeMin = opening && !closedAllDay ? minutesFromHHMM(opening.closeTime) : GRID_END_MIN
            return (
              <div
                key={d.toDateString()}
                className={cn("relative border-s border-hair-soft", isToday && "bg-cobalt/[0.035]")}
              >
                {closedAllDay ? (
                  <ClosedBand top={0} bottom={GRID_HEIGHT} label={t("settings.schedule.closed")} />
                ) : (
                  <>
                    {openMin > GRID_START_MIN && <ClosedBand top={0} bottom={topOf(openMin)} />}
                    {closeMin < GRID_END_MIN && (
                      <ClosedBand top={topOf(closeMin)} bottom={GRID_HEIGHT} label={t("settings.schedule.closed")} />
                    )}
                  </>
                )}

                {list.map((apt) => {
                  const startMin = minutesFromHHMM(apt.start)
                  const endMin = minutesFromHHMM(apt.end)
                  const top = topOf(startMin)
                  const height = Math.max(topOf(endMin) - top, 12)
                  const tall = height >= 36
                  const mark = STATUS_MARK[apt.status]
                  const isNext = apt.id === nextId
                  const debt = owing.has(apt.patientId) && mark !== "cancel"
                  // Type is said in words, never in colour. "Adjustments" is the
                  // ordinary visit, so only the others are named on the block.
                  const typeWord = apt.appointmentType === "adjustments" ? null : t(`appt.type.${apt.appointmentType}`)
                  const canonical = appointments.find((a) => a.id === apt.id) ?? apt
                  const spoken = [
                    apt.patientName,
                    `${apt.start}–${apt.end}`,
                    t(`appt.type.${apt.appointmentType}`),
                    t(`appt.status.${apt.status}`),
                    debt ? t("dashboard.patient.debtTitle") : null,
                  ]
                    .filter(Boolean)
                    .join(", ")
                  return (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => {
                        setActiveAppointment(canonical)
                        setDialogOpen(true)
                      }}
                      aria-label={spoken}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-[4px] border px-1.5 text-start text-sm text-ink transition-colors focus-visible:z-20 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
                        tall ? "py-0.5 leading-4" : "leading-4",
                        mark === "plan" && "z-[1] border-ink/45 bg-paper hover:bg-ground",
                        mark === "unsure" && "z-[1] border-dashed border-ink/55 bg-paper hover:bg-ground",
                        mark === "done" && "z-[1] border-transparent bg-olive-tint hover:border-olive/40",
                        mark === "cancel" && "z-0 border-dashed border-hair bg-paper/70 text-mute",
                        isNext && "z-[2] border-2 border-solid border-cobalt bg-cobalt-tint",
                      )}
                      style={{ top, height }}
                    >
                      <span className={cn("flex min-w-0 items-baseline gap-1", tall && "block truncate")}>
                        <span
                          className={cn(
                            "truncate",
                            mark === "cancel" ? "font-medium line-through" : "font-bold",
                            isNext && "text-cobalt",
                          )}
                        >
                          {apt.patientName}
                        </span>
                        {!tall && <span className="shrink-0 tabular-nums text-mute">{apt.start}</span>}
                      </span>
                      {tall && (
                        <span className={cn("block truncate tabular-nums", mark === "done" ? "text-olive" : "text-mute")}>
                          {apt.start}
                          {typeWord ? ` · ${typeWord}` : ""}
                        </span>
                      )}
                    </button>
                  )
                })}

                {isToday && nowMinutes !== null && nowMinutes >= GRID_START_MIN && nowMinutes <= GRID_END_MIN && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[3] h-0.5 bg-signal"
                    style={{ top: topOf(nowMinutes) - 1 }}
                    aria-hidden
                  >
                    <span className="absolute -start-[5px] -top-1 size-2.5 rounded-full bg-signal" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <AppointmentEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="edit"
        appointment={activeAppointment}
        allAppointments={appointments}
        onSave={(item, { isNew }) => commitAppointment(item, { isNew })}
      />
    </div>
  )
}

function ClosedBand({ top, bottom, label }: { top: number; bottom: number; label?: string }) {
  if (bottom <= top) return null
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center pt-2.5"
      style={{ top, height: bottom - top, backgroundImage: HATCH }}
      aria-hidden
    >
      {label && bottom - top >= 40 && <span className="text-sm text-mute">{label}</span>}
    </div>
  )
}
