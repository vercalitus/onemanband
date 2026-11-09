"use client"

import { CalendarDays, Plus, TriangleAlert, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  PagePlate,
  PlateDebt,
  PlateDivider,
  PlateFact,
  PlateSpacer,
} from "@/components/layout/page-plate"
import { Button, buttonVariants } from "@/components/ui/button"
import { StateLegend, StateMark } from "@/components/ui/state-mark"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAddTask } from "@/components/providers/add-task-provider"
import { useGlobalAddPatient } from "@/components/providers/global-add-patient-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { approveIntake } from "@/features/automations/lib/remote-intakes"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { useTodos } from "@/components/providers/todos-provider"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"
import {
  DISMISSED_SIGNALS_EVENT,
  dismissSignal,
  fetchDismissals,
  pruneDismissals,
} from "@/features/dashboard/lib/dismissed-signals"
import { setDashboardVisitCount } from "@/lib/dashboard-visit-count"
import { toISODate } from "@/lib/date-helpers"
import { localeToBcp47 } from "@/lib/format-locale"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { usePulseMetrics } from "@/features/dashboard/lib/use-pulse-metrics"
import { localizeTodoTitle } from "@/lib/i18n/localized-seed"
import type { TodoItem } from "@/types/domain"
import { cn } from "@/lib/utils"

/**
 * Rows shown per board section before it folds.
 *
 * Small on purpose, and applied to both halves. An unbounded column is the
 * same failure as a notification badge that only climbs: it stops being read.
 * The rest stays one click away and the count is stated, so nothing is
 * silently hidden.
 */
const SECTION_VISIBLE = 5

const PRIORITY_RANK: Record<TodoItem["priority"], number> = { high: 0, medium: 1, low: 2 }

const addMinutesToHHMM = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/**
 * The one button on "visit not closed", which asks its question.
 *
 * Two answers, and neither is taken for the practitioner. "Came" goes to the
 * chart to close the session, because a visit that happened needs its record
 * and its charge at the amount agreed, not a status flipped from here.
 * "Didn't come" marks the no-show, which is what starts its message and charge.
 */
function VisitOutcomeMenu({
  label,
  onCame,
  onMissed,
}: {
  label: string
  onCame: () => void
  onMissed: () => void
}) {
  const { t } = useLocale()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[12rem] p-1.5">
        <DropdownMenuItem onClick={onCame}>{t("signal.action.visitCame")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onMissed}>{t("signal.action.visitMissed")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One board row.
 *
 * Two shapes, because the halves of the board mean different things. An active
 * task is work you finish, so it gets a checkbox. An attention signal is
 * derived from clinic data — ticking "invoice overdue" would not pay it, and
 * the row would return on the next derivation — so it gets a dismiss instead:
 * "I've seen this", recorded separately and self-clearing once the underlying
 * fact resolves.
 */
function TodoRow({
  item,
  onToggleComplete,
  onDismiss,
}: {
  item: TodoItem
  onToggleComplete: (id: string) => void
  onDismiss?: (id: string) => void
}) {
  const { t } = useLocale()
  const router = useRouter()
  const { openCreateAppointment, confirmAppointment, commitAppointment, markNoShow } =
    useScheduleDay()
  const { openGlobalAddPatient } = useGlobalAddPatient()
  const done = Boolean(item.completed)
  // Reactive signals carry i18n keys + params; authored tasks carry plain strings.
  const title = item.titleKey ? t(item.titleKey, item.params) : item.title
  const dueText = item.dueKey ? t(item.dueKey, item.params) : item.due
  const dueTrimmed = dueText.trim()
  const markDoneAria = `${done ? t("dashboard.todo.markNotDone") : t("dashboard.todo.markDone")}: ${title}`
  const isFault = item.tone === "fault"

  return (
    <div className="flex min-h-[60px] items-center gap-3 border-b border-hair-soft py-2.5 ps-4 pe-2 sm:ps-6">
      {onDismiss ? (
        // A fault is the software failing; an overdue row is the clinic's
        // "act now". Everything else needs no mark — the sentence says it.
        <span className="flex w-5 shrink-0 justify-center" aria-hidden>
          {isFault ? (
            <TriangleAlert className="size-5 text-destructive" />
          ) : item.overdue ? (
            <StateMark state="now" />
          ) : null}
        </span>
      ) : (
        <label className="-ms-3 flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={done}
            onChange={() => onToggleComplete(item.id)}
            className="size-5 rounded-[4px] border-2 border-ink accent-cobalt"
            aria-label={markDoneAria}
          />
        </label>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn("text-[17px] leading-snug", done ? "text-mute line-through decoration-1" : "text-ink")}>
          {title}
          {isFault && <span className="sr-only"> ({t("dashboard.badge.fault")})</span>}
          {item.overdue && !done && !isFault && <span className="sr-only"> ({t("dashboard.badge.attention")})</span>}
        </p>
        <p
          className={cn(
            "text-sm",
            done ? "text-faint" : isFault ? "text-destructive" : item.overdue ? "font-medium text-ink" : "text-mute",
          )}
        >
          {/* A signal's second line is a sentence — "Connect it under
              Settings" — and "Due Connect it under Settings" is not. The
              prefix belongs to tasks, which carry a due date. */}
          {/* A signal's line already says it is overdue ("15d overdue"),
              so only a task gets the prefix. */}
          {!dueTrimmed
            ? t("dashboard.todo.noDue")
            : item.kind === "reactive"
              ? dueTrimmed
              : `${item.overdue && !done ? t("dashboard.todo.overduePrefix") : t("dashboard.todo.duePrefix")} ${dueTrimmed}`}
        </p>
      </div>

      {/*
        The one thing to do about it.
        A derived row used to describe a problem and stop there, which left the
        practitioner to go and find the screen himself — most of the work and
        all of the friction. Confirming and booking happen here; everything else
        lands on the exact record, not on the page that contains it.
      */}
      {item.action?.kind === "visitOutcome" && !done && (
        <VisitOutcomeMenu
          label={t(item.action.labelKey)}
          onCame={() => {
            if (item.action?.kind !== "visitOutcome") return
            // The chart closes the session against this visit, not against
            // whatever happens to be booked today.
            router.push(
              `/patients/${item.action.patientId}?visit=${item.action.appointmentId}#active-session`,
            )
          }}
          onMissed={() => {
            if (item.action?.kind === "visitOutcome") markNoShow(item.action.appointmentId)
          }}
        />
      )}
      {item.action && item.action.kind !== "visitOutcome" && !done && (
        <button
          type="button"
          onClick={() => {
            const action = item.action
            if (!action) return
            if (action.kind === "link") router.push(action.href)
            else if (action.kind === "confirm") confirmAppointment(action.appointmentId)
            else if (action.kind === "intake")
              openGlobalAddPatient({
                prefill: action.prefill,
                intake: action.review,
                // Closed only for a record that exists. A save that failed
                // leaves the registration on the board, which is the truth.
                onSaved: (saved, { bookRequestedSlot }) => {
                  if (!saved) return
                  void approveIntake(action.intakeId, saved.id)
                  const { requestedDate, requestedStart, requestedType } = action.review
                  if (!bookRequestedSlot || !requestedDate || !requestedStart) return
                  // The slot the patient asked for, on the record that now
                  // exists — through the one booking path, so the database
                  // rules on the overlap and the reminder ladder is laid.
                  const type = requestedType ?? "first"
                  const minutes =
                    readClinicSettings().treatmentTypes.find((row) => row.type === type)
                      ?.defaultMinutes ?? 30
                  commitAppointment(
                    {
                      id: crypto.randomUUID(),
                      patientId: saved.id,
                      patientName: saved.fullName,
                      date: requestedDate,
                      dayLabel: "",
                      provider: "",
                      start: requestedStart,
                      end: addMinutesToHHMM(requestedStart, minutes),
                      status: "scheduled",
                      treatment: action.prefill.complaint ?? "",
                      appointmentType: type,
                    },
                    // The record is seconds old and not yet in the cached
                    // list; the reminder needs the number from here.
                    { isNew: true, contact: { phone: saved.phone, email: saved.email } },
                  )
                },
              })
            else if (action.kind === "schedule")
              openCreateAppointment(
                action.date,
                { id: action.patientId, name: action.patientName },
                action.start ? { start: action.start } : undefined,
              )
          }}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0",
            isFault && "border-destructive/50 text-destructive",
          )}
        >
          {t(item.action.labelKey)}
        </button>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-sunk hover:text-ink"
          aria-label={`${t("dashboard.todo.dismiss")}: ${title}`}
          title={t("dashboard.todo.dismiss")}
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

/**
 * One half of the board.
 *
 * Both halves fold past `SECTION_VISIBLE` and both state the remainder — a
 * long list of tasks stops being read for the same reason a long list of
 * alerts does, so the rule is not special to signals. Collapse state is per
 * section: expanding your tasks should not also expand the alerts.
 */
function BoardSection({
  label,
  emptyLabel,
  items,
  onToggleComplete,
  onDismiss,
  action,
}: {
  label: string
  emptyLabel: string
  items: TodoItem[]
  onToggleComplete: (id: string) => void
  onDismiss?: (id: string) => void
  /** One control beside the section's name, e.g. "Add task". */
  action?: React.ReactNode
}) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)

  const hidden = Math.max(0, items.length - SECTION_VISIBLE)
  const shown = expanded ? items : items.slice(0, SECTION_VISIBLE)

  return (
    <section>
      <div className="flex min-h-14 items-end gap-3 px-4 pb-2 sm:px-6">
        <h3 className="flex items-baseline gap-2 text-[17px] font-bold text-ink">
          {label}
          <span className="text-sm font-medium tabular-nums text-mute">{items.length}</span>
        </h3>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      <div className="border-t border-hair-soft">
        {shown.length === 0 ? (
          <p className="px-4 py-4 text-sm text-mute sm:px-6">{emptyLabel}</p>
        ) : (
          shown.map((item) => (
            <TodoRow
              key={item.id}
              item={item}
              onToggleComplete={onToggleComplete}
              onDismiss={onDismiss}
            />
          ))
        )}
        {/* A capped list must say what it is hiding, or it reads as "all clear". */}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="min-h-11 w-full text-sm font-medium text-cobalt underline-offset-3 hover:underline"
          >
            {expanded ? t("dashboard.todo.showLess") : t("dashboard.todo.showAll", { count: hidden })}
          </button>
        )}
      </div>
    </section>
  )
}

export function DashboardOverview() {
  const { locale, t, visitsToday } = useLocale()
  const { appointments: dayAppointments } = useScheduleDay()
  const { todos, toggleComplete, signalsAreLive } = useTodos()
  const { openAddTask } = useAddTask()

  // The header says "N visits today", so N is today's: the provider holds the
  // diary for months ahead, and counting all of it announced three visits on a
  // day with none because somebody was booked for next week.
  useEffect(() => {
    const today = toISODate(new Date())
    setDashboardVisitCount(
      dayAppointments.filter((a) => a.date === today && a.status !== "cancelled").length,
    )
  }, [dayAppointments])

  /**
   * The clock, read after mount (the server's is UTC — see DayCalendarView) and
   * once a minute after that. It decides which visit the plate calls "next".
   */
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const today = useMemo(() => {
    if (!now) return null
    const iso = toISODate(now)
    const minutes = now.getHours() * 60 + now.getMinutes()
    const visits = dayAppointments.filter((a) => a.date === iso && a.status !== "cancelled")
    const next = [...visits]
      .filter((a) => a.status !== "completed" && a.status !== "no_show" && minutesFromHHMM(a.start) >= minutes)
      .sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))[0]
    const tag = localeToBcp47(locale)
    return {
      count: visits.length,
      next,
      weekday: now.toLocaleDateString(tag, { weekday: "long" }),
      dayMonth: now.toLocaleDateString(tag, { day: "numeric", month: "short" }),
    }
  }, [now, dayAppointments, locale])

  const localizedTodos = useMemo(
    () => todos.map((item) => localizeTodoTitle(item, locale, (k) => t(k))),
    [todos, locale, t],
  )

  const { metrics: pulseMetrics, live: pulseIsLive } = usePulseMetrics()

  /**
   * Three paragraphs of clinic analysis, written once and true of nobody —
   * "two patients with open plans have gone 21+ days without a visit". They
   * read as findings about this practice, so they are shown only while the app
   * is a demonstration. Real observations would have to be derived from real
   * records, and until they are, saying nothing is the honest option.
   */
  const clinicPulseItems = useMemo(() => {
    if (pulseIsLive) return []
    return ([1, 2, 3] as const).map((i) => ({
      title: t(`pulse.obs.${i}.title`),
      body: t(`pulse.obs.${i}.body`),
    }))
  }, [t, pulseIsLive])

  /**
   * Dismissals live outside the todo list so they survive a refresh, and are
   * pruned against what is currently derived — a condition that resolves and
   * later returns must not arrive pre-silenced.
   */
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const attentionIds = useMemo(
    () =>
      localizedTodos
        .filter((x) => !x.completed && x.kind === "reactive")
        .map((x) => x.id),
    [localizedTodos],
  )

  /**
   * Load what has been waved away, and clear out what no longer applies.
   *
   * Pruning waits for the clinic's own signals. Before they arrive the derived
   * list is the demo's, and pruning against it would delete every real
   * dismissal — the alerts would all come back on every page load, which is the
   * exact failure the record exists to prevent.
   */
  useEffect(() => {
    let cancelled = false
    const sync = () => {
      const load = signalsAreLive ? pruneDismissals(attentionIds) : fetchDismissals()
      void load.then((ids) => {
        if (!cancelled && ids) setDismissed(ids)
      })
    }
    sync()
    window.addEventListener(DISMISSED_SIGNALS_EVENT, sync)
    return () => {
      cancelled = true
      window.removeEventListener(DISMISSED_SIGNALS_EVENT, sync)
    }
  }, [attentionIds, signalsAreLive])

  const { attention, active, completed } = useMemo(
    () => ({
      attention: localizedTodos
        .filter((x) => !x.completed && x.kind === "reactive" && !dismissed.has(x.id))
        // Faults outrank everything: a message that never sent is the software
        // failing, not a job on the list.
        .sort((a, b) => {
          const fault = Number(b.tone === "fault") - Number(a.tone === "fault")
          if (fault !== 0) return fault
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        }),
      active: localizedTodos.filter((x) => !x.completed && x.kind === "active"),
      completed: localizedTodos.filter((x) => x.completed),
    }),
    [localizedTodos, dismissed],
  )

  const metric = (id: string) => pulseMetrics.find((m) => m.id === id)
  const visitsMetric = metric("visits")
  const debtMetric = metric("debt")

  return (
    <>
      {/* The day on the plate: the date, who is next, and the two numbers a
          practice runs on. The rest of the old "pulse" cards was decoration. */}
      <PagePlate>
        {today && (
          <>
            <PlateFact label={today.weekday} display>
              {today.dayMonth}
            </PlateFact>
            <PlateDivider />
            {today.next ? (
              <PlateFact
                label={`${t("dashboard.plate.next")} · ${today.next.patientName}`}
                now
                display
                className="max-w-[16rem]"
              >
                {today.next.start}
              </PlateFact>
            ) : (
              <PlateFact label={t("dashboard.plate.next")}>{t("dashboard.plate.noNext")}</PlateFact>
            )}
            <PlateDivider />
            {visitsMetric && <PlateFact label={visitsMetric.label}>{visitsMetric.value}</PlateFact>}
            {debtMetric && <PlateDebt amount={debtMetric.value} label={debtMetric.label} />}
            <PlateSpacer />
            {today.next && (
              <Link href={`/patients/${today.next.patientId}`} className={buttonVariants({ size: "lg" })}>
                {t("dashboard.plate.openChart")}
              </Link>
            )}
          </>
        )}
      </PagePlate>

      {/* Full bleed under the plate: the day on paper, the board on ground,
          one hairline between them — no cards. */}
      <div className="-mx-4 -mt-6 -mb-3 grid sm:-mx-6 md:-mt-8 lg:min-h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 flex-col bg-paper" aria-labelledby="today-clinic">
          <div className="flex min-h-16 items-center gap-3 border-b border-hair px-4 sm:px-6">
            <h2 id="today-clinic" className="flex items-baseline gap-2 text-[17px] font-bold text-ink">
              {t("dashboard.todayClinic")}
              {today && <span className="text-sm font-medium tabular-nums text-mute">{visitsToday(today.count)}</span>}
            </h2>
            <Link href="/calendar" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ms-auto")}>
              <CalendarDays className="size-4" aria-hidden />
              {t("nav.calendar")}
            </Link>
          </div>
          <DayCalendarView
            appointments={dayAppointments}
            heightClassName="h-auto lg:h-[calc(100dvh-6rem-4rem-3.25rem)]"
          />
          <StateLegend
            className="mt-auto border-t border-hair px-4 py-3 sm:px-6"
            items={[
              { state: "done", label: t("appt.status.completed") },
              { state: "plan", label: t("appt.status.scheduled") },
              { state: "unsure", label: t("appt.status.uncertain") },
              { state: "cancel", label: t("appt.status.cancelled") },
              { state: "now", label: t("dashboard.timeline.now") },
            ]}
          />
        </section>

        <section
          className="min-w-0 border-t border-hair bg-ground pb-8 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:border-s lg:border-t-0"
          aria-label={t("dashboard.todoBoard")}
        >
          <BoardSection
            label={t("dashboard.todo.reactive")}
            emptyLabel={t("dashboard.todo.noReactive")}
            items={attention}
            onToggleComplete={toggleComplete}
            onDismiss={(id) => void dismissSignal(id)}
          />

          <BoardSection
            label={t("dashboard.todo.active")}
            emptyLabel={t("dashboard.todo.noActive")}
            items={active}
            onToggleComplete={toggleComplete}
            action={
              <Button type="button" variant="outline" size="sm" onClick={openAddTask}>
                <Plus className="size-4" aria-hidden />
                {t("dashboard.todo.add")}
              </Button>
            }
          />

          {completed.length > 0 && (
            <section>
              <h3 className="px-4 pt-6 pb-2 text-[17px] font-bold text-ink sm:px-6">{t("dashboard.todo.completed")}</h3>
              <div className="border-t border-hair-soft">
                {completed.map((item) => (
                  <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />
                ))}
              </div>
            </section>
          )}

          {clinicPulseItems.length > 0 && (
            <section className="mt-6">
              <h3 className="px-4 pb-2 text-[17px] font-bold text-ink sm:px-6">{t("dashboard.observations.title")}</h3>
              <div className="border-t border-hair-soft">
                {clinicPulseItems.map((item) => (
                  <div key={item.title} className="border-b border-hair-soft px-4 py-3 sm:px-6">
                    <p className="text-[17px] font-medium text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-mute">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </>
  )
}
