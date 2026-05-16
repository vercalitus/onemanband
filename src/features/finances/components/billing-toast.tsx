"use client"

import { CheckCircle2 } from "lucide-react"
import { useEffect } from "react"

import { cn } from "@/lib/utils"

/**
 * Lightweight confirmation — the Financial OS does not ship a global toaster;
 * this is scoped to billing actions only.
 */
export function BillingToast({
  open,
  message,
  onOpenChange,
}: {
  open: boolean
  message: string
  onOpenChange: (open: boolean) => void
}) {
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => onOpenChange(false), 3200)
    return () => window.clearTimeout(t)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-white px-4 py-3 shadow-lg",
        "ring-1 ring-slate-100",
      )}
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      <p className="text-sm font-medium leading-snug text-slate-800">{message}</p>
    </div>
  )
}
