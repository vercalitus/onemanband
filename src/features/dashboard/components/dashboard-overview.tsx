"use client"

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  CircleCheckBig,
  Coins,
  Gauge,
  ListTodo,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { useEffect, useMemo } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAddTask } from "@/components/providers/add-task-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { useTodos } from "@/components/providers/todos-provider"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"
import { darkCardHeaderClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { setDashboardVisitCount } from "@/lib/dashboard-visit-count"
import { localizedPulseMetrics, localizeTodoTitle } from "@/lib/i18n/localized-seed"
import { dashboardMetrics } from "@/lib/mock-data"
import type { TodoItem } from "@/types/domain"
import { cn } from "@/lib/utils"

const trendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  steady: CircleCheckBig,
}

const pulseIconChrome = "bg-sky-100 text-sky-600"

const metricAccent = {
  visits: {
    icon: CalendarCheck2,
    iconClass: pulseIconChrome,
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
  capacity: {
    icon: Gauge,
    iconClass: pulseIconChrome,
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
  revenue: {
    icon: Coins,
    iconClass: pulseIconChrome,
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
  debt: {
    icon: Wallet,
    iconClass: pulseIconChrome,
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
} as const

function TodoRow({
  item,
  onToggleComplete,
}: {
  item: TodoItem
  onToggleComplete: (id: string) => void
}) {
  const { t } = useLocale()
  const done = Boolean(item.completed)
  // Reactive signals carry i18n keys + params; authored tasks carry plain strings.
  const title = item.titleKey ? t(item.titleKey, item.params) : item.title
  const dueText = item.dueKey ? t(item.dueKey, item.params) : item.due
  const dueTrimmed = dueText.trim()
  const markDoneAria = `${done ? t("dashboard.todo.markNotDone") : t("dashboard.todo.markDone")}: ${title}`

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-px ${
        done
          ? "border-slate-100 bg-slate-50/90"
          : item.overdue
            ? "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]"
            : "border-slate-200/70 bg-white"
      }`}
    >
      <label className="flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggleComplete(item.id)}
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
          aria-label={markDoneAria}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{title}</p>
        <p className={`text-xs ${done ? "text-slate-400" : "text-slate-500"}`}>
          {dueTrimmed
            ? `${item.overdue && !done ? t("dashboard.todo.overduePrefix") : t("dashboard.todo.duePrefix")} ${dueTrimmed}`
            : t("dashboard.todo.noDue")}
        </p>
      </div>
      {item.overdue && !done && (
        <Badge variant="outline" className="border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]">
          {t("dashboard.badge.attention")}
        </Badge>
      )}
    </div>
  )
}

export function DashboardOverview() {
  const { locale, t } = useLocale()
  const { appointments: dayAppointments, setAppointments: setDayAppointments } = useScheduleDay()
  const { todos, toggleComplete } = useTodos()
  const { openAddTask } = useAddTask()

  useEffect(() => {
    setDashboardVisitCount(dayAppointments.length)
  }, [dayAppointments])

  const localizedTodos = useMemo(
    () => todos.map((item) => localizeTodoTitle(item, locale, (k) => t(k))),
    [todos, locale, t],
  )

  const pulseMetrics = useMemo(
    () => localizedPulseMetrics(dashboardMetrics, locale, (k) => t(k)),
    [locale, t],
  )

  const clinicPulseItems = useMemo(() => {
    return ([1, 2, 3] as const).map((i) => ({
      title: t(`pulse.obs.${i}.title`),
      body: t(`pulse.obs.${i}.body`),
    }))
  }, [t])

  const { reactive, active, completed } = useMemo(() => {
    const reactive = localizedTodos.filter((x) => !x.completed && x.kind === "reactive")
    const active = localizedTodos.filter((x) => !x.completed && x.kind === "active")
    const completed = localizedTodos.filter((x) => x.completed)
    return { reactive, active, completed }
  }, [localizedTodos])

  return (
    <div>
      <section className="grid gap-6 md:gap-7 xl:grid-cols-[1.45fr_1fr]">
        <Card className={`min-h-0 xl:min-h-[540px] ${elevatedCardClass}`}>
          <CardHeader className={cn(darkCardHeaderClass, "py-3")}>
            <div className="flex items-center gap-2.5">
              <CalendarCheck2 className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">{t("dashboard.todayClinic")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
            <DayCalendarView appointments={dayAppointments} onAppointmentsChange={setDayAppointments} />
          </CardContent>
        </Card>

        <Card className={elevatedCardClass}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <ListTodo className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">{t("dashboard.todoBoard")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
            <div className="space-y-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t("dashboard.todo.reactive")}
              </p>
              <div className="space-y-3">
                {reactive.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
                    {t("dashboard.todo.noReactive")}
                  </p>
                ) : (
                  reactive.map((item) => <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />)
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t("dashboard.todo.active")}
              </p>
              <div className="mt-2 space-y-3">
                {active.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
                    {t("dashboard.todo.noActive")}
                  </p>
                ) : (
                  active.map((item) => <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />)
                )}
              </div>
            </div>

            <div className="flex justify-center border-t border-slate-100 pt-5 pb-1">
              <button
                type="button"
                onClick={openAddTask}
                className="inline-flex items-center gap-1.5 px-0 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
                aria-label={t("dashboard.todo.add")}
              >
                <span>{t("dashboard.todo.add")}</span>
                <Plus className="size-4 shrink-0 stroke-[2] text-sky-600" aria-hidden />
              </button>
            </div>

            {completed.length > 0 && (
              <div className="border-t border-slate-100 pt-5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("dashboard.todo.completed")}
                </p>
                <div className="mt-2 space-y-3">
                  {completed.map((item) => (
                    <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="mt-12 border-t border-slate-200/75 pt-8">
        <h2 className="mb-5 text-center text-[1.625rem] font-bold leading-snug tracking-tight text-slate-900">
          {t("dashboard.pulse.title")}
        </h2>
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          {pulseMetrics.map((metric) => {
            const TrendIcon = trendIcon[metric.trend]
            const accent = metricAccent[metric.id as keyof typeof metricAccent]
            const AccentIcon = accent.icon
            const trendTone =
              metric.trend === "down"
                ? "border border-sky-200/80 bg-sky-100/90 text-sky-900"
                : "border border-sky-100 bg-sky-50 text-sky-800"

            return (
              <Card
                key={metric.id}
                className={`group min-h-[156px] overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-0.5 ${accent.cardClass} ${accent.shadow}`}
              >
                <CardHeader className="relative gap-5">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      {metric.label}
                    </CardDescription>
                    <span className={`inline-flex size-8 items-center justify-center rounded-full ${accent.iconClass}`}>
                      <AccentIcon className="size-4 stroke-[1.7]" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CardTitle className="font-mono text-[2.25rem] font-bold tracking-[-0.05em] tabular-nums text-slate-900">
                      {metric.value}
                    </CardTitle>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${trendTone}`}
                    >
                      <TrendIcon className="size-3 stroke-[1.8]" />
                      {metric.delta}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] transition-all duration-200 md:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <TrendingUp className="size-5 stroke-[1.6]" />
            </span>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">{t("dashboard.observations.title")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {clinicPulseItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition-colors duration-200 md:border-slate-100 md:bg-white"
              >
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
