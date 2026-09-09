"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { AUTOMATION_STORE_EVENT } from "@/features/automations/lib/automation-store"
import { useRemoteResponses } from "@/features/automations/lib/remote-responses"
import { deriveAutomationTodos } from "@/features/dashboard/lib/automation-signals"
import {
  createTask,
  fetchTasks,
  isTaskRow,
  setTaskCompleted,
} from "@/features/dashboard/lib/task-repository"
import { fetchAppointments } from "@/features/calendar/lib/appointment-repository"
import { deriveReactiveTodos } from "@/features/dashboard/lib/reactive-signals"
import {
  fetchInvoices,
  fetchUninvoicedVisits,
} from "@/features/finances/lib/finance-repository"
import { clinicHasPatients, fetchPatients } from "@/features/patients/lib/patient-repository"
import { fetchTreatmentCounts } from "@/features/patients/lib/treatment-repository"
import { useLocale } from "@/components/providers/locale-provider"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { isSupabaseConfigured } from "@/lib/env"
import {
  dashboardTodos,
  patients as mockPatients,
  todaySchedule,
  weeklySchedule,
} from "@/lib/mock-data"
import { seedInvoices, seedUninvoicedVisits } from "@/lib/mock-finances"
import type { TodoItem } from "@/types/domain"

function normalize(seed: TodoItem[]): TodoItem[] {
  return seed.map((t) => ({
    ...t,
    kind: t.kind ?? "reactive",
    completed: t.completed ?? false,
  }))
}

/**
 * Initial board = system-derived reactive signals + any hand-authored
 * active/completed seeds. The old hardcoded reactive rows are replaced by the
 * reactive-signal engine (see reactive-signals.ts).
 */
/** Board rows owned by the automation store rather than by clinic data. */
const isAutomationRow = (id: string) =>
  id.startsWith("rx-sendfail-") ||
  id.startsWith("rx-patientcancel-") ||
  id.startsWith("rx-patientmove-") ||
  id.startsWith("rx-questionnaire-") ||
  id.startsWith("rx-newpatient-")

/** The demo board, for a deploy with no clinic behind it. */
function seedTodos(): TodoItem[] {
  const authored = dashboardTodos.filter((t) => t.kind && t.kind !== "reactive")
  return normalize([
    ...deriveReactiveTodos({
      appointments: [...todaySchedule, ...weeklySchedule],
      invoices: seedInvoices,
      uninvoicedVisits: seedUninvoicedVisits,
      patients: mockPatients,
      treatmentCounts: new Map(),
    }),
    ...authored,
  ])
}

type TodosContextValue = {
  todos: TodoItem[]
  setTodos: Dispatch<SetStateAction<TodoItem[]>>
  /**
   * True once the attention signals are the clinic's own rather than the seed.
   *
   * The board needs this before it prunes dismissals: the live derivation is
   * asynchronous, and pruning against an empty or still-demo list would delete
   * every real dismissal and bring all the alerts back on the next load.
   */
  signalsAreLive: boolean
  /** Add a clinician-created task. Used by both dashboard board and the global Add menu. */
  addActiveTask: (input: { title: string; due: string }) => void
  /** Toggle completion for a given task id. */
  toggleComplete: (id: string) => void
}

const TodosContext = createContext<TodosContextValue | null>(null)

export function useTodos(): TodosContextValue {
  const ctx = useContext(TodosContext)
  if (!ctx) {
    throw new Error("TodosProvider is missing from the tree.")
  }
  return ctx
}

/**
 * Holds the dashboard todo list so the same source feeds the in-page board
 * and any global Add-task entry point (header bar).
 */
export function TodosProvider({ children }: { children: ReactNode }) {
  const { formatMoney } = useLocale()
  // The demo board only where there is no clinic to derive one from. A
  // configured deploy starts empty: the seed rows point at demo patients, and
  // for the moment before the real board arrived they were clickable.
  const [todos, setTodos] = useState<TodoItem[]>(() =>
    isSupabaseConfigured() ? [] : seedTodos(),
  )
  const [signalsAreLive, setSignalsAreLive] = useState(false)

  /**
   * Fold in signals from patient self-service (cancellations, reschedules,
   * registrations, returned questionnaires).
   *
   * After mount, never during render: the automation store is localStorage in
   * mock mode, so deriving these in `seedTodos` would make the server and the
   * client produce different lists and break hydration. Completion state
   * already in the board is preserved on refresh.
   */
  const remoteResponses = useRemoteResponses()

  /**
   * Re-derive the whole board from the clinic's own records.
   *
   * Everything at once, rather than the three schedule signals this used to
   * replace. The money ones stayed on the demo seed and were then wiped along
   * with it, so a real invoice past its due date produced nothing at all — the
   * board simply had no opinion about money. Since the engine reads one input
   * object, feeding it the real thing is what makes every signal live together.
   *
   * Fetched here rather than taken from the schedule provider because this one
   * sits above it in the tree.
   */
  useEffect(() => {
    let cancelled = false
    const settings = readClinicSettings()
    const priceOf = (type: "first" | "adjustments" | "kupa") =>
      settings.treatmentTypes.find((tt) => tt.type === type)?.priceIls ?? 0

    const derive = async () => {
      const hasPatients = await clinicHasPatients()
      if (cancelled || !hasPatients) return

      const [schedule, invoiceFetch, uninvoiced, patientFetch, counts, billing] = await Promise.all([
        fetchAppointments(),
        fetchInvoices(formatMoney),
        fetchUninvoicedVisits(formatMoney, priceOf),
        fetchPatients(),
        fetchTreatmentCounts(),
        // A provider that cannot file a document is worth saying out loud
        // before somebody takes payment and finds out afterwards. A failure to
        // ask is not a failure to connect, so it stays silent.
        fetch("/api/billing/ping")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ])
      if (cancelled) return

      const derived = deriveReactiveTodos({
        appointments: schedule.source === "live" ? schedule.appointments : [],
        invoices: invoiceFetch.source === "live" ? invoiceFetch.invoices : [],
        uninvoicedVisits: uninvoiced,
        patients: patientFetch.source === "live" ? patientFetch.patients : [],
        treatmentCounts: counts ?? new Map(),
        billing: billing
          ? { ok: !!billing.ok, provider: billing.provider, message: billing.message }
          : null,
      })

      /*
       * The demo board goes in the same breath as the real one arrives.
       *
       * Two steps used to do this — clear, then re-derive — and between them
       * the board was empty. Doing both in one update means it is never
       * momentarily wrong, and never shows an invented debtor beside a real
       * one. Rows owned by the automation store are left alone: they come from
       * a different source and are reconciled separately.
       */
      const seeded = new Set(dashboardTodos.map((t) => t.id))
      setTodos((prev) => [
        ...prev.filter(
          (t) => !seeded.has(t.id) && (!t.id.startsWith("rx-") || isAutomationRow(t.id)),
        ),
        ...normalize(derived),
      ])
      setSignalsAreLive(true)
    }

    // A board that cannot be derived is a quiet board, not a broken app. This
    // provider sits above every page, so an unhandled rejection here would take
    // the whole shell down over a to-do list.
    void derive().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [formatMoney])

  useEffect(() => {
    const sync = () => {
      const derived = deriveAutomationTodos(remoteResponses)
      setTodos((prev) => {
        const byId = new Map(prev.map((t) => [t.id, t]))
        const fresh = derived.filter((t) => !byId.has(t.id))
        // Drop rows whose source response has since been handled elsewhere.
        const stillValid = new Set(derived.map((t) => t.id))
        const kept = prev.filter((t) => !isAutomationRow(t.id) || stillValid.has(t.id))
        return fresh.length ? [...kept, ...fresh] : kept
      })
    }
    sync()
    window.addEventListener(AUTOMATION_STORE_EVENT, sync)
    return () => window.removeEventListener(AUTOMATION_STORE_EVENT, sync)
  }, [remoteResponses])

  /**
   * The practitioner's own tasks, loaded from the clinic rather than invented
   * at mount. Anything already on the board that is a saved task is replaced,
   * so a reload does not double them up.
   */
  useEffect(() => {
    let cancelled = false
    void fetchTasks().then((tasks) => {
      if (cancelled || !tasks) return
      setTodos((prev) => [...prev.filter((t) => !isTaskRow(t.id)), ...tasks])
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Written down, then saved.
   *
   * Shown immediately under a temporary id and swapped for the saved row when
   * it comes back — typing a task and watching it appear a beat later is worse
   * than the round trip is worth. A task that fails to save keeps its temporary
   * id and stays on the board for this session rather than vanishing, which is
   * the lesser of the two ways to lose it.
   */
  const addActiveTask = useCallback(({ title, due }: { title: string; due: string }) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const pendingId = `task-pending-${Date.now()}`
    setTodos((prev) => [
      ...prev,
      {
        id: pendingId,
        title: trimmed,
        due: due.trim(),
        priority: "medium",
        kind: "active",
        completed: false,
      },
    ])
    void createTask({ title: trimmed, due: due.trim() }).then((saved) => {
      if (!saved) return
      setTodos((prev) => prev.map((t) => (t.id === pendingId ? saved : t)))
    })
  }, [])

  /**
   * Ticking a saved task writes the change through. A derived signal has no
   * checkbox — the board dismisses those instead, because ticking "invoice
   * overdue" does not pay the invoice.
   */
  const toggleComplete = useCallback((id: string) => {
    let nowCompleted = false
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        nowCompleted = !t.completed
        return { ...t, completed: nowCompleted }
      }),
    )
    if (isTaskRow(id) && !id.startsWith("task-pending-")) {
      void setTaskCompleted(id, nowCompleted)
    }
  }, [])

  const value = useMemo<TodosContextValue>(
    () => ({ todos, setTodos, signalsAreLive, addActiveTask, toggleComplete }),
    [todos, signalsAreLive, addActiveTask, toggleComplete],
  )

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
}
