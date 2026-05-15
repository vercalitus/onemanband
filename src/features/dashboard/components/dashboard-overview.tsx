"use client"

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  Circle,
  CircleCheckBig,
  Coins,
  Flag,
  Gauge,
  ListTodo,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"
import { appointmentTypeVisual, APPOINTMENT_TYPE_OPTIONS } from "@/lib/appointment-types"
import { darkCardHeaderClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { setDashboardVisitCount } from "@/lib/dashboard-visit-count"
import { dashboardMetrics, dashboardTodos, todaySchedule } from "@/lib/mock-data"
import type { TodoItem } from "@/types/domain"

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
  capacity: {
    icon: Gauge,
    iconClass: "bg-indigo-100 text-indigo-500",
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
    title: "Monthly utilization",
    body: "This month’s booked slots are trending full mid-week; lighter Mondays leave room for recalls or admin.",
  },
  {
    title: "Care-plan gaps",
    body: "Month to date, two patients with open plans have gone 21+ days without a visit — worth a quick outreach.",
  },
  {
    title: "Collections (MTD)",
    body: "Outstanding balances improved versus last month; one payer invoice still needs escalation before month-end.",
  },
] as const

function normalizeTodos(seed: TodoItem[]): TodoItem[] {
  return seed.map((t) => ({
    ...t,
    kind: t.kind ?? "reactive",
    completed: t.completed ?? false,
  }))
}

/** Single row in the dashboard todo board — checkbox drives completed without persistence (demo UX). */
function TodoRow({
  item,
  onToggleComplete,
}: {
  item: TodoItem
  onToggleComplete: (id: string) => void
}) {
  const done = Boolean(item.completed)
  const PriorityGlyph = priorityIcon[item.priority]

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
          aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
        />
      </label>
      <span
        className={`inline-flex size-9 items-center justify-center rounded-full ${priorityTone[item.priority]} ${done ? "opacity-50" : ""}`}
      >
        <PriorityGlyph className="size-4 stroke-[1.8]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{item.title}</p>
        <p className={`text-xs ${done ? "text-slate-400" : "text-slate-500"}`}>
          {item.overdue && !done ? "Overdue" : "Due"} {item.due}
        </p>
      </div>
      {item.overdue && !done && (
        <Badge variant="outline" className="border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]">
          Attention
        </Badge>
      )}
    </div>
  )
}

export function DashboardOverview() {
  const [dayAppointments, setDayAppointments] = useState(() => [...todaySchedule])
  const [todos, setTodos] = useState<TodoItem[]>(() => normalizeTodos(dashboardTodos))
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDue, setNewDue] = useState("")
  const [newPriority, setNewPriority] = useState<TodoItem["priority"]>("medium")

  useEffect(() => {
    setDashboardVisitCount(dayAppointments.length)
  }, [dayAppointments])

  const { reactive, active, completed } = useMemo(() => {
    const reactive = todos.filter((t) => !t.completed && t.kind === "reactive")
    const active = todos.filter((t) => !t.completed && t.kind === "active")
    const completed = todos.filter((t) => t.completed)
    return { reactive, active, completed }
  }, [todos])

  function toggleComplete(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    )
  }

  function handleAddTask(e: FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    const due = newDue.trim() || "—"
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `todo-${crypto.randomUUID().slice(0, 10)}`
        : `todo-${Date.now()}`

    setTodos((prev) => [
      ...prev,
      {
        id,
        title,
        due,
        priority: newPriority,
        kind: "active",
        completed: false,
      },
    ])
    setNewTitle("")
    setNewDue("")
    setNewPriority("medium")
    setAddOpen(false)
  }

  return (
    <div>
      <section className="mt-4 mb-0 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card className={`min-h-[540px] ${elevatedCardClass}`}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <CalendarCheck2 className="size-5 stroke-[1.6] text-sky-400" />
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-white">Today&apos;s Clinic</CardTitle>
              </div>
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
          <CardContent className="space-y-5 px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
            <div className="space-y-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Reactive</p>
              <div className="space-y-3">
                {reactive.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
                    No reactive items right now.
                  </p>
                ) : (
                  reactive.map((item) => <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />)
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Active</p>
              <div className="mt-2 space-y-3">
                {active.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
                    No active tasks — add one with +.
                  </p>
                ) : (
                  active.map((item) => <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />)
                )}
              </div>
            </div>

            {completed.length > 0 && (
              <div className="border-t border-slate-100 pt-5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">Completed</p>
                <div className="mt-2 space-y-3">
                  {completed.map((item) => (
                    <TodoRow key={item.id} item={item} onToggleComplete={toggleComplete} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center border-t border-slate-100 pt-4">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-2 text-slate-500 outline-none transition-colors hover:text-slate-800"
                aria-label="Add task"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="size-4 shrink-0" />
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add active task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="todo-title" className="text-xs font-medium text-slate-600">
                Title
              </label>
              <Input
                id="todo-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Call insurer about claim"
                required
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="todo-due" className="text-xs font-medium text-slate-600">
                Due time (optional)
              </label>
              <Input id="todo-due" value={newDue} onChange={(e) => setNewDue(e.target.value)} placeholder="14:00" />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Priority</span>
              <div className="flex flex-wrap gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <label key={p} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="priority"
                      checked={newPriority === p}
                      onChange={() => setNewPriority(p)}
                      className="text-sky-600 focus:ring-sky-500/30"
                    />
                    <span className="capitalize text-slate-700">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit">Save task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="mt-16 border-t border-slate-200/75 pt-12">
        <h2 className="mb-5 text-center text-[1.625rem] font-bold leading-snug tracking-tight text-slate-900">Pulse</h2>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => {
            const TrendIcon = trendIcon[metric.trend]
            const accent = metricAccent[metric.id as keyof typeof metricAccent]
            const AccentIcon = accent.icon
            const trendTone =
              metric.trend === "down"
                ? "bg-[rgb(248,228,214)] text-[rgb(171,119,93)]"
                : metric.id === "visits" || metric.id === "capacity"
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

        <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] transition-all duration-200 md:p-6">
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
