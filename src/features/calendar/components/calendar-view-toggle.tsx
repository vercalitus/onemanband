"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

export type CalendarView = "day" | "week" | "month"

const VIEWS: CalendarView[] = ["day", "week", "month"]

/**
 * Day / Week / Month — a segmented control drawn for the cobalt plate:
 * the chosen view is a white fill with cobalt text, the others white on cobalt.
 */
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
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-white/25 p-[3px]"
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
              "h-11 min-w-16 rounded-[4px] px-3.5 text-sm transition-colors",
              active
                ? "bg-white font-bold text-cobalt"
                : "font-medium text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            {t(`calendar.view.${view}`)}
          </button>
        )
      })}
    </div>
  )
}
