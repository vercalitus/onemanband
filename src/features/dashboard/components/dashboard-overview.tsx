"use client"

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  Circle,
  CircleCheckBig,
  Coins,
  Flag,
  HeartPulse,
  ListTodo,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { useState } from "react"
import { AddTaskLink } from "@/features/dashboard/components/add-task-link"
import { darkCardHeaderClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { appointmentTypeVisual, APPOINTMENT_TYPE_OPTIONS } from "@/lib/appointment-types"
import { dashboardMetrics, dashboardTodos, todaySchedule } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"

const trendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  steady: CircleCheckBig,
}

const priorityTone = {
  low: "bg-[rgb(150,182,197,0.18)] text-[rgb(91,123,138)]",
  medium: "bg-[rgb(120,157,138,0.16)] text-[rgb(92,123,110)]",
  high: "bg-[rgb(248,228,214)] text-[rgb(171,119,93)]",
} as const

const priorityIcon = {
  low: Circle,
  medium: Circle,
  high: Flag,
} as const

const metricAccent = {
  visits: {
    icon: CalendarCheck2,
    iconClass: "bg-sky-100 text-sky-500",
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
  retention: {
    icon: HeartPulse,
    iconClass: "bg-emerald-100 text-emerald-500",
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
  revenue: {
    icon: Coins,
    iconClass: "bg-emerald-100 text-emerald-500",
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
  debt: {
    icon: Wallet,
    iconClass: "bg-orange-100 text-orange-400",
    cardClass: "border-slate-100 bg-white",
    shadow: "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]",
  },
} as const

const clinicPulseItems = [
  {
    title: "Utilization outlook",
    body: "Wednesday afternoon is nearing full capacity. Consider moving frozen-patient outreach to Thursday.",
  },
  {
    title: "Retention watch",
    body: "Two patients with unfinished care plans have not been seen for 21+ days.",
  },
  {
    title: "Collections momentum",
    body: "Outstanding balances decreased week-over-week, but one insurance invoice still needs escalation.",
  },
] as const

export function DashboardOverview() {
  const [dayAppointments, setDayAppointments] = useState(() => [...todaySchedule])

  return (
    <div>
      <section className="mb-10 mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card className={`min-h-[540px] ${elevatedCardClass}`}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <CalendarCheck2 className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">Today&apos;s Clinic</CardTitle>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-medium text-white/85">
              {APPOINTMENT_TYPE_OPTIONS.map((key) => {
                const v = appointmentTypeVisual[key]
                return (
                  <span key={key} className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${v.chip}`} aria-hidden />
                    {v.label}
                  </span>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/55">
              Click an empty slot to add. Click a visit to reschedule. Times are in 5-minute steps (5–60 min).
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
            <DayCalendarView appointments={dayAppointments} onAppointmentsChange={setDayAppointments} />
          </CardContent>
        </Card>

        <Card className={elevatedCardClass}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <ListTodo className="size-5 stroke-[1.6] text-amber-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">To Do List</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
            {dashboardTodos.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-px ${
                  item.overdue
                    ? "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]"
                    : "border-slate-200/70 bg-white"
                }`}
              >
                <span className={`inline-flex size-9 items-center justify-center rounded-full ${priorityTone[item.priority]}`}>
                  {(() => {
                    const Icon = priorityIcon[item.priority]
                    return <Icon className="size-4 stroke-[1.8]" />
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.overdue ? "Overdue" : "Due"} {item.due}
                  </p>
                </div>
                {item.overdue && (
                  <Badge variant="outline" className="border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]">
                    Attention
                  </Badge>
                )}
              </div>
            ))}
            <div className="flex justify-center border-t border-slate-100 pt-4">
              <AddTaskLink
                className="inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-2 text-slate-500 outline-none transition-colors hover:text-slate-800"
                aria-label="Add task"
              >
                <Plus className="size-4 shrink-0" />
              </AddTaskLink>
            </div>
          </CardContent>
        </Card>
      </section>

      <div>
        <h2 className="mb-5 text-center text-[1.625rem] font-bold leading-snug tracking-tight text-slate-900">
          {`Pulse & Goals`}
        </h2>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => {
            const TrendIcon = trendIcon[metric.trend]
            const accent = metricAccent[metric.id as keyof typeof metricAccent]
            const AccentIcon = accent.icon
            const trendTone =
              metric.trend === "down"
                ? "bg-[rgb(248,228,214)] text-[rgb(171,119,93)]"
                : metric.id === "visits"
                  ? "bg-[rgb(233,242,248)] text-[rgb(91,123,138)]"
                  : "bg-[rgb(232,242,238)] text-[rgb(92,123,110)]"

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

        <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] md:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <TrendingUp className="size-5 stroke-[1.6]" />
            </span>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">Clinic Pulse</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {clinicPulseItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:border-slate-100 md:bg-white"
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
