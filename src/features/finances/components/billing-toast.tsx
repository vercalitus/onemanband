"use client"

import { useEffect } from "react"

import { StateMark } from "@/components/ui/state-mark"
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
        "pointer-events-none fixed bottom-6 end-6 z-[100] flex max-w-sm items-center gap-3 rounded-md border border-hair bg-paper px-4 py-3",
      )}
    >
      <StateMark state="done" />
      <p className="text-[17px] font-medium leading-snug text-ink">{message}</p>
    </div>
  )
}
