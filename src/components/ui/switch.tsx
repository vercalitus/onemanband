"use client"

import { cn } from "@/lib/utils"

/**
 * Accessible toggle — Base UI Switch not in deps; this follows the same
 * interaction model as shadcn Switch (role=switch, keyboard).
 */
export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-cobalt" : "bg-slate-300",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white ring-0 transition-transform",
          checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5 rtl:-translate-x-0.5",
        )}
      />
    </button>
  )
}
