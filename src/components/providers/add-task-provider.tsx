"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ClipboardList } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const IGNORE_DISMISS_REASONS = new Set(["outside-press", "focus-out"])

type AddTaskContextValue = {
  openAddTask: () => void
}

const AddTaskContext = createContext<AddTaskContextValue | null>(null)

/** Never throws — avoids white-screen if a consumer renders outside the provider by mistake. */
export function useAddTask(): AddTaskContextValue {
  const ctx = useContext(AddTaskContext)
  return ctx ?? { openAddTask: () => {} }
}

export function AddTaskProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  /** True after "add task" from another route until we land on /dashboard and open the dialog. */
  const pendingOpenRef = useRef(false)
  const suppressSpuriousCloseUntil = useRef(0)

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const openAddTask = useCallback(() => {
    suppressSpuriousCloseUntil.current = Date.now() + 500
    if (pathname === "/dashboard") {
      setOpen(true)
      return
    }
    pendingOpenRef.current = true
    router.push("/dashboard")
  }, [pathname, router])

  /**
   * One effect for pathname: do not clear `pendingOpenRef` when pathname !== /dashboard —
   * that race cancelled "navigate then open" (user stuck, broken navigation).
   */
  useEffect(() => {
    if (pathname === "/dashboard") {
      if (pendingOpenRef.current) {
        pendingOpenRef.current = false
        suppressSpuriousCloseUntil.current = Date.now() + 500
        setOpen(true)
      }
      return
    }
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (open) {
      suppressSpuriousCloseUntil.current = Date.now() + 500
    }
  }, [open])

  const onDialogOpenChange = useCallback(
    (nextOpen: boolean, eventDetails?: { reason?: string }) => {
      if (nextOpen) return
      const reason = eventDetails?.reason as string | undefined
      if (
        reason &&
        IGNORE_DISMISS_REASONS.has(reason) &&
        Date.now() < suppressSpuriousCloseUntil.current
      ) {
        return
      }
      close()
    },
    [close]
  )

  return (
    <AddTaskContext.Provider value={{ openAddTask }}>
      {children}
      <Dialog modal={false} open={open} onOpenChange={onDialogOpenChange}>
        <DialogContent
          showCloseButton
          className="max-w-md gap-0 overflow-hidden rounded-3xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-md"
        >
          <DialogTitle className="sr-only">Add task</DialogTitle>
          <div className="flex flex-col gap-4 p-5 pt-6">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <ClipboardList className="size-6 stroke-[1.6]" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Add task</p>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Reminder or follow-up for your clinic.
                </DialogDescription>
              </div>
            </div>
            <Input
              autoFocus
              placeholder="What needs doing?"
              aria-label="Task title"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="button" onClick={close}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AddTaskContext.Provider>
  )
}
