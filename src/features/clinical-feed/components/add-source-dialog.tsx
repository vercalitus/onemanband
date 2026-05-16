"use client"

import { useEffect, useState, type FormEvent } from "react"
import { XIcon } from "lucide-react"

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
 * Lightweight dialog for adding a custom Clinical Feed source. URL is optional
 * — at this stage we only track display data; backend ingestion (RSS / API)
 * will be wired in a later iteration.
 */
export function AddSourceDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { name: string; url?: string }) => void
}) {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setUrl("")
  }, [open])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, url: url.trim() || undefined })
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
        <DialogDescription className="sr-only">Add a new clinical feed source.</DialogDescription>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-5 right-5 z-20 rounded-xl text-white hover:bg-white/15"
              aria-label="Close"
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
              Add a source
            </DialogTitle>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-3">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label
                  htmlFor="src-name"
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  Source name
                </label>
                <Input
                  id="src-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NEJM"
                  required
                  autoFocus
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  htmlFor="src-url"
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  URL (optional)
                </label>
                <Input
                  id="src-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  className="h-11 rounded-xl border-slate-200"
                />
                <p className="text-[11px] text-slate-400">
                  Live ingestion (RSS / API) is coming later. For now this just records the source.
                </p>
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
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 min-w-[7.5rem] rounded-xl bg-sky-600 px-6 font-semibold text-white hover:bg-sky-700"
            >
              Add source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
