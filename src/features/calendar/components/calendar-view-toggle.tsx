"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

export type CalendarView = "day" | "week" | "month"

const VIEWS: CalendarView[] = ["day", "week", "month"]

/** Day / Week / Month segment — labels from i18n. */
export function CalendarViewToggle({
  value,
  onChange,
}: {
  value: CalendarView
  onChange: (view: CalendarView) => void
}) {
  const { t } = useLocale()

  return (
    <div
      role="tablist"
      aria-label={t("calendar.aria.calendarView")}
      className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5"
    >
      {VIEWS.map((view) => {
        const active = view === value
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors",
              active
                ? "bg-white text-sky-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {t(`calendar.view.${view}`)}
          </button>
        )
      })}
    </div>
  )
}
