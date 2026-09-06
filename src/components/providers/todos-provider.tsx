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
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { dashboardTodos } from "@/lib/mock-data"
import type { ScheduleItem, TodoItem } from "@/types/domain"

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

function seedTodos(): TodoItem[] {
  const authored = dashboardTodos.filter((t) => t.kind && t.kind !== "reactive")
  return normalize([...deriveReactiveTodos(), ...authored])
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
   * The clinic's real diary, for the signals derived from it ("confirm
   * tomorrow's appointment").
   *
   * Fetched here rather than taken from ScheduleDayProvider because this
   * provider sits above it in the tree. One extra query on the dashboard is a
   * better trade than reordering the provider stack, and it disappears when
   * the schedule finds a single owner.
   */
  const [liveSchedule, setLiveSchedule] = useState<ScheduleItem[] | undefined>(undefined)
  useEffect(() => {
    void Promise.all([fetchAppointments(), clinicHasPatients()]).then(
      ([result, hasPatients]) => {
        if (result.source !== "live") return
        // An empty array is an answer once the clinic is real: no bookings, so
        // no signals. Leaving the seed would put fictional patients on the
        // board beside genuine work.
        if (result.appointments.length || hasPatients) {
          setLiveSchedule(result.appointments)
        }
      },
    )
  }, [])

  /**
   * Clear the demo board once the clinic has real patients.
   *
   * The seeded to-dos name invented people and link to records that do not
   * exist — "chase overdue payment" for someone who was never a patient here.
   * They were useful while the whole app was a demonstration; beside real work
   * they are noise at best and a wrong instruction at worst.
   */
  useEffect(() => {
    void clinicHasPatients().then((hasPatients) => {
      if (!hasPatients) return
      const seeded = new Set(dashboardTodos.map((t) => t.id))
      setTodos((prev) =>
        prev.filter((t) => !seeded.has(t.id) && !t.id.startsWith("rx-")),
      )
    })
  }, [])

  useEffect(() => {
    // Re-derive the schedule-driven signals once the real diary arrives.
    if (!liveSchedule) return
    // The three signals that read the diary. The rest of `deriveReactiveTodos`
    // is about invoices and patients and is not this stage's business.
    const fromSchedule = (id: string) =>
      id.startsWith("rx-confirm-") || id.startsWith("rx-intake-") || id.startsWith("rx-noshow-")
    const derived = deriveReactiveTodos(new Date(), liveSchedule)
    setTodos((prev) => [
      ...prev.filter((t) => !fromSchedule(t.id)),
      ...derived.filter((t) => fromSchedule(t.id)),
    ])
  }, [liveSchedule])

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
