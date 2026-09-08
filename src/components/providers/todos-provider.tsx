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
  const [todos, setTodos] = useState<TodoItem[]>(seedTodos)

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

    void (async () => {
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
    })()

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

  const addActiveTask = useCallback(({ title, due }: { title: string; due: string }) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `todo-${crypto.randomUUID().slice(0, 10)}`
        : `todo-${Date.now()}`
    setTodos((prev) => [
      ...prev,
      {
        id,
        title: trimmed,
        due: due.trim(),
        priority: "medium",
        kind: "active",
        completed: false,
      },
    ])
  }, [])

  const toggleComplete = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }, [])

  const value = useMemo<TodosContextValue>(
    () => ({ todos, setTodos, addActiveTask, toggleComplete }),
    [todos, addActiveTask, toggleComplete],
  )

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
}
