"use client"

import { useEffect, useState, type FormEvent } from "react"
import { XIcon } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Reusable "Add active task" dialog so the dashboard board and the global
 * top-bar Add menu open the exact same form (same fields, same styling).
 */
export function AddTaskDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { title: string; due: string }) => void
}) {
  const { t, locale } = useLocale()
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")

  // Reset fields whenever the dialog reopens so we never carry stale state across uses.
  useEffect(() => {
    if (!open) return
    setTitle("")
    setDate("")
    setTime("")
  }, [open])

  // Combine the date + time pickers into a single readable due label, localized
  // at creation time. Any subset is valid: date-only, time-only, or neither.
  function composeDue(): string {
    if (date) {
      const d = new Date(`${date}T${time || "00:00"}`)
      if (Number.isNaN(d.getTime())) return time
      return time
        ? d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
        : d.toLocaleDateString(locale, { dateStyle: "medium" })
    }
    return time
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, due: composeDue() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(90dvh,calc(100dvh-2rem))] min-h-0 w-full flex-col gap-0 overflow-hidden rounded-3xl border-slate-200/90 p-0 shadow-2xl sm:max-w-lg",
        )}
      >
        <DialogDescription className="sr-only">{t("addTask.description")}</DialogDescription>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-5 right-5 z-20 rounded-xl text-white hover:bg-white/15"
              aria-label={t("addTask.close")}
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="relative shrink-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-6 pb-3 pt-4 text-white">
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-sky-400/10 blur-3xl"
            aria-hidden
          />
          <DialogHeader className="relative gap-0 space-y-0">
            <DialogTitle className="font-heading pr-12 text-xl font-semibold tracking-tight text-white">
              {t("addTask.title")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-3">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label
                  htmlFor="todo-title"
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  {t("addTask.field.title")}
                </label>
                <Input
                  id="todo-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("addTask.placeholder.title")}
                  required
                  autoFocus
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="todo-date"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    {t("addTask.field.date")}
                  </label>
                  <Input
                    id="todo-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 tabular-nums"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="todo-time"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    {t("addTask.field.time")}
                  </label>
                  <Input
                    id="todo-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="relative z-[1] mx-0 mb-0 mt-0 shrink-0 rounded-b-3xl border-t border-slate-200/95 bg-slate-50 px-6 py-3 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl min-w-[6.5rem]"
              onClick={() => onOpenChange(false)}
            >
              {t("addTask.footer.cancel")}
            </Button>
            <Button
              type="submit"
              className="h-11 min-w-[7.5rem] rounded-xl bg-sky-600 px-6 font-semibold text-white hover:bg-sky-700"
            >
              {t("addTask.footer.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
