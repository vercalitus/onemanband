"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"

import { AddTaskDialog } from "@/features/dashboard/components/add-task-dialog"
import { useTodos } from "@/components/providers/todos-provider"

type AddTaskContextValue = {
  openAddTask: () => void
}

const AddTaskContext = createContext<AddTaskContextValue | null>(null)

/** Never throws — avoids white-screen if a consumer renders outside the provider by mistake. */
export function useAddTask(): AddTaskContextValue {
  const ctx = useContext(AddTaskContext)
  return ctx ?? { openAddTask: () => {} }
}

/**
 * Opens the same "Add active task" dialog used on the dashboard from anywhere
 * in the app (e.g. the top-bar Add menu). Must sit under TodosProvider.
 */
export function AddTaskProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { addActiveTask } = useTodos()

  const openAddTask = useCallback(() => {
    setOpen(true)
  }, [])

  return (
    <AddTaskContext.Provider value={{ openAddTask }}>
      {children}
      <AddTaskDialog
        open={open}
        onOpenChange={setOpen}
        onSave={(input) => {
          addActiveTask(input)
          setOpen(false)
        }}
      />
    </AddTaskContext.Provider>
  )
}
