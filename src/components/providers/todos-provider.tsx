"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { dashboardTodos } from "@/lib/mock-data"
import type { TodoItem } from "@/types/domain"

function normalize(seed: TodoItem[]): TodoItem[] {
  return seed.map((t) => ({
    ...t,
    kind: t.kind ?? "reactive",
    completed: t.completed ?? false,
  }))
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
  const [todos, setTodos] = useState<TodoItem[]>(() => normalize(dashboardTodos))

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
