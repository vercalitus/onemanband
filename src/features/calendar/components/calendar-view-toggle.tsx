"use client"

import { cn } from "@/lib/utils"

export type CalendarView = "day" | "week" | "month"

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
]

/**
 * Segmented control that switches the scheduler between Day / Week / Month.
 * Kept stateless so the parent owns the active view + URL/state if needed.
 */
export function CalendarViewToggle({
  value,
  onChange,
}: {
  value: CalendarView
  onChange: (view: CalendarView) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5"
    >
      {VIEWS.map((view) => {
        const active = view.value === value
        return (
          <button
            key={view.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors",
              active
                ? "bg-white text-sky-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {view.label}
          </button>
        )
      })}
    </div>
  )
}
