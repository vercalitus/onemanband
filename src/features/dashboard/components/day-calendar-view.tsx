"use client"

import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StateMark, type MarkState } from "@/components/ui/state-mark"
import type { AppointmentStatus, AppointmentType, ScheduleItem } from "@/types/domain"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { useAppointmentTypeVisual } from "@/lib/use-appointment-type-visual"
import { useOutstandingBalances } from "@/features/calendar/lib/payment-status"
import { usePlanProgress } from "@/features/calendar/lib/plan-progress"
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  clampStartForDuration,
  minutesFromHHMM,
  snapMinutesToSlotNearest,
} from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { localizeScheduleRow } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"

const DAY_START_MIN = CALENDAR_HOUR_START * 60
const DAY_END_MIN = CALENDAR_HOUR_END * 60

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

/** The present moment: one orange rule across the day, with the time on it. */
function NowDivider({ label, aria }: { label: string; aria: string }) {
  return (
    <div className="relative my-1 flex h-6 items-center" role="separator" aria-label={aria}>
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-signal" aria-hidden />
      <span className="relative ms-4 rounded-[4px] bg-signal px-2 text-sm leading-6 font-bold tabular-nums text-ink sm:ms-6">
        {label}
      </span>
    </div>
  )
}

/** A gap worth filling: hatched, so it reads as open time rather than as a visit. */
function FreeGap({
  from,
  label,
  actionLabel,
  onBook,
}: {
  from: string
  label: string
  actionLabel: string
  onBook: () => void
}) {
  return (
    <div className="grid min-h-[52px] grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-hair-soft bg-[repeating-linear-gradient(-45deg,transparent_0_7px,rgb(22_24_26/0.07)_7px_8px)] ps-4 pe-2 sm:ps-6">
      <span className="text-sm tabular-nums text-mute">{from}</span>
      <p className="truncate text-sm font-medium text-ink">{label}</p>
      <Button type="button" variant="outline" size="sm" onClick={onBook}>
        {actionLabel}
      </Button>
    </div>
  )
}

/** Shorter gaps are the ordinary slack of a day, not something to fill. */
const FREE_GAP_MIN = 30

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

export function DayCalendarView({
  appointments,
  selectedDate,
  showCanceled = true,
  showAddButton = true,
  heightClassName = "h-[min(70vh,520px)] md:h-[500px]",
}: {
  appointments: ScheduleItem[]
  selectedDate?: Date
  showCanceled?: boolean
  showAddButton?: boolean
  heightClassName?: string
}) {
  const { locale, t } = useLocale()
  const owing = useOutstandingBalances()
  const planProgress = usePlanProgress()
  const typeVisualBase = useAppointmentTypeVisual()

  const typeVisual = useMemo(() => {
    const types: AppointmentType[] = ["first", "adjustments", "kupa"]
    const out = { ...typeVisualBase }
    for (const k of types) {
      out[k] = { ...out[k], label: t(`appt.type.${k}`) }
    }
    return out
  }, [typeVisualBase, t])

  /** Each status in the one vocabulary (DESIGN.md), with its own word beside it. */
  const statusMark = useMemo(
    (): Record<AppointmentStatus, { mark: MarkState; label: string; tone: string }> => ({
      confirmed: { mark: "plan", label: t("appt.status.confirmed"), tone: "text-ink" },
      scheduled: { mark: "plan", label: t("appt.status.scheduled"), tone: "text-mute" },
      uncertain: { mark: "unsure", label: t("appt.status.uncertain"), tone: "text-mute" },
      completed: { mark: "done", label: t("appt.status.completed"), tone: "text-olive" },
      cancelled: { mark: "cancel", label: t("appt.status.cancelled"), tone: "text-mute" },
      no_show: { mark: "cancel", label: t("appt.status.no_show"), tone: "text-ink" },
    }),
    [t],
  )

  const localized = useMemo(
    () => appointments.map((a) => localizeScheduleRow(a, locale)),
    [appointments, locale],
  )

  const effectiveISO = useMemo(() => toISODate(selectedDate ?? new Date()), [selectedDate])
  const todayISO = toISODate(new Date())
  const isViewingToday = effectiveISO === todayISO

  const visible = useMemo(() => {
    const sameDay = localized.filter((a) => a.date === effectiveISO)
    const list = showCanceled ? sameDay : sameDay.filter((a) => a.status !== "cancelled")
    return sortByStart(list)
  }, [localized, effectiveISO, showCanceled])

  /**
   * Minutes into the day, on the clock of whoever is looking.
   *
   * Read after mount, never during render: the server's clock is UTC and the
   * clinic's is three hours ahead, so the "now" line was drawn in two places
   * at once and React failed hydration on the dashboard every single load.
   * Null until then, which simply means the line is not drawn yet. It ticks
   * once a minute so it keeps up with the day.
   */
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
  useEffect(() => {
    const read = () => {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }
    read()
    const timer = window.setInterval(read, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const showNowLine =
    isViewingToday &&
    currentMinutes !== null &&
    currentMinutes >= DAY_START_MIN &&
    currentMinutes < DAY_END_MIN

  const resolveCanonical = useCallback(
    (row: ScheduleItem) => appointments.find((a) => a.id === row.id) ?? row,
    [appointments],
  )

  const { commitAppointment } = useScheduleDay()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("edit")
  const [activeAppointment, setActiveAppointment] = useState<ScheduleItem | null>(null)
  const [defaultStartMinutes, setDefaultStartMinutes] = useState<number | undefined>(undefined)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)

  const openEdit = useCallback(
    (displayRow: ScheduleItem) => {
      const apt = resolveCanonical(displayRow)
      setDialogMode("edit")
      setActiveAppointment(apt)
      setDefaultStartMinutes(undefined)
      setDefaultDate(undefined)
      setDialogOpen(true)
    },
    [resolveCanonical],
  )

  const openCreateDefault = () => {
    const defaultDuration = 15
    // Before the clock has been read, a new booking starts where it does on
    // any other day rather than at minute zero.
    const baseMinutes =
      isViewingToday && currentMinutes !== null ? currentMinutes : DAY_START_MIN + 60
    const snapped = snapMinutesToSlotNearest(baseMinutes)
    const clamped = clampStartForDuration(snapped, defaultDuration)
    setDialogMode("create")
    setActiveAppointment(null)
    setDefaultStartMinutes(clamped)
    setDefaultDate(effectiveISO)
    setDialogOpen(true)
  }

  const openCreateAt = (minutes: number) => {
    setDialogMode("create")
    setActiveAppointment(null)
    setDefaultStartMinutes(clampStartForDuration(snapMinutesToSlotNearest(minutes), 15))
    setDefaultDate(effectiveISO)
    setDialogOpen(true)
  }

  /** The next visit still to come today: drawn in cobalt so the eye lands on it. */
  const nextId = useMemo(() => {
    if (!isViewingToday || currentMinutes === null) return null
    const next = visible.find(
      (a) =>
        minutesFromHHMM(a.start) >= currentMinutes &&
        a.status !== "cancelled" &&
        a.status !== "completed" &&
        a.status !== "no_show",
    )
    return next?.id ?? null
  }, [visible, isViewingToday, currentMinutes])

  const renderTiles = () => {
    let markerPlaced = false
    let prevEnd: number | null = null
    const nodes: ReactNode[] = []
    const nowLabel = t("dashboard.timeline.now")

    visible.forEach((apt, idx) => {
      const startMin = minutesFromHHMM(apt.start)
      const endMin = minutesFromHHMM(apt.end)

      if (showNowLine && !markerPlaced) {
        const gapStart = prevEnd ?? DAY_START_MIN
        if (currentMinutes !== null && currentMinutes >= gapStart && currentMinutes < startMin) {
          nodes.push(<NowDivider key={`now-gap-${apt.id}`} label={nowLabel} aria={nowLabel} />)
          markerPlaced = true
        }
      }

      if (
        showNowLine &&
        !markerPlaced &&
        currentMinutes !== null &&
        currentMinutes >= startMin &&
        currentMinutes < endMin
      ) {
        nodes.push(<NowDivider key={`now-in-${apt.id}`} label={nowLabel} aria={nowLabel} />)
        markerPlaced = true
      }

      // Open time between two visits, once it is long enough to book.
      if (idx > 0 && prevEnd !== null && startMin - prevEnd >= FREE_GAP_MIN && apt.status !== "cancelled") {
        const gapStart = prevEnd
        nodes.push(
          <FreeGap
            key={`gap-${apt.id}`}
            from={hhmm(gapStart)}
            label={t("dashboard.day.free", { minutes: startMin - gapStart, time: apt.start })}
            actionLabel={t("dashboard.day.book")}
            onBook={() => openCreateAt(gapStart)}
          />,
        )
      }

      const status = statusMark[apt.status]
      const typeStyle = typeVisual[apt.appointmentType]
      const isPast = apt.status === "completed" || apt.status === "no_show"
      const isNext = apt.id === nextId
      const isCancelled = apt.status === "cancelled"
      const debt = owing.has(apt.patientId)
      /*
       * Which visit of the plan this one is. A cancelled slot is not a visit,
       * so it says nothing; and the plan is only quoted where it bounds the
       * count — once it has been worked through, the card shows the visit
       * number alone rather than "12 of 8".
       */
      const plan = isCancelled ? undefined : planProgress.get(apt.patientId)
      const planLabel = plan
        ? plan.done + 1 <= plan.target
          ? t("appointment.plan.of", { current: plan.done + 1, total: plan.target })
          : t("appointment.plan.past", { current: plan.done + 1 })
        : null

      nodes.push(
        <div
          key={apt.id}
          role="button"
          tabIndex={0}
          aria-current={isNext ? "true" : undefined}
          className={cn(
            "grid min-h-[60px] cursor-pointer grid-cols-[64px_14px_minmax(0,1fr)_auto_44px] items-center gap-x-3.5 border-b border-hair-soft py-2 ps-4 pe-1 transition-colors hover:bg-ground focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-cobalt sm:ps-6",
            isNext && "bg-cobalt-tint hover:bg-cobalt-tint",
          )}
          onClick={() => openEdit(apt)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openEdit(apt)
            }
          }}
        >
          <time
            dateTime={apt.start}
            className={cn(
              "text-[22px] leading-none font-medium tabular-nums",
              isPast || isCancelled ? "text-mute" : "text-ink",
              isNext && "font-bold text-cobalt",
              isCancelled && "line-through decoration-1",
            )}
          >
            {apt.start}
          </time>
          <StateMark state={status.mark} />
          <div className="min-w-0">
            <p className="truncate">
              <span className={cn("font-bold text-ink", isCancelled && "font-medium text-mute line-through decoration-1")}>
                {apt.patientName}
              </span>
              <span className="text-sm text-mute">
                {" · "}
                {typeStyle.label}
                {" · "}
                <span className="tabular-nums">{t("dashboard.day.minutes", { n: endMin - startMin })}</span>
                {planLabel && (
                  <>
                    {" · "}
                    <span className="tabular-nums">{planLabel}</span>
                  </>
                )}
              </span>
            </p>
            {apt.treatment && <p className="truncate text-sm text-mute">{apt.treatment}</p>}
          </div>
          <div className="flex items-center justify-end gap-2">
            {/* A balance owed, as the one orange outline in the row. A word
                on every row of a busy day was louder than the visits. */}
            {debt && !isCancelled && (
              <span
                className="flex size-6 items-center justify-center rounded-[4px] border-[1.5px] border-signal text-sm font-bold text-ink"
                title={t("dashboard.patient.debtTitle")}
              >
                <span aria-hidden>₪</span>
                <span className="sr-only">{t("dashboard.patient.debtTitle")}</span>
              </span>
            )}
            <span className={cn("hidden text-sm font-medium whitespace-nowrap sm:inline", status.tone)}>{status.label}</span>
          </div>
          <Link
            href={`/patients/${apt.patientId}?tab=records`}
            className="flex size-11 items-center justify-center rounded-md text-faint transition-colors hover:bg-paper hover:text-cobalt"
            title={t("dashboard.patient.recordsLink")}
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
            <span className="sr-only">{t("dashboard.patient.openChart", { name: apt.patientName })}</span>
          </Link>
        </div>,
      )

      prevEnd = Math.max(prevEnd ?? 0, endMin)
    })

    if (
      showNowLine &&
      !markerPlaced &&
      currentMinutes !== null &&
      currentMinutes >= (prevEnd ?? DAY_START_MIN) &&
      currentMinutes < DAY_END_MIN
    ) {
      nodes.push(<NowDivider key="now-trailing" label={nowLabel} aria={nowLabel} />)
    }

    if (nodes.length === 0) {
      nodes.push(
        <p key="empty" className="px-6 py-10 text-center text-[17px] text-mute">
          {t("dashboard.day.empty")}
        </p>,
      )
    }

    return nodes
  }

  return (
    <>
      <ScrollArea className={heightClassName}>
        <div className="scroll-pb-24">
          <div>{renderTiles()}</div>
          {showAddButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mx-4 mt-3 mb-6 w-[calc(100%-2rem)] sm:mx-6 sm:w-[calc(100%-3rem)]"
              onClick={openCreateDefault}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {t("dashboard.day.addAppointment")}
            </Button>
          ) : null}
        </div>
      </ScrollArea>

      <AppointmentEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        appointment={activeAppointment}
        defaultStartMinutes={defaultStartMinutes}
        defaultDate={defaultDate}
        allAppointments={appointments}
        onSave={(item, { isNew }) => commitAppointment(item, { isNew })}
      />
    </>
  )
}
