"use client"

import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { groupSlotsByDate, type FreeSlot } from "@/features/automations/lib/availability"
import { cn } from "@/lib/utils"

/**
 * Day-then-time slot picker for the public pages.
 *
 * Two steps rather than one long list: a patient on a phone scans days far
 * faster than a flat column of eighty timestamps. Only days that actually have
 * a free slot appear, so an empty tap is impossible.
 */
export function SlotPicker({
  slots,
  onPick,
  emptyLabel,
}: {
  slots: FreeSlot[]
  onPick: (slot: FreeSlot) => void
  emptyLabel: string
}) {
  const { t, localeTag } = useLocale()
  const days = useMemo(() => groupSlotsByDate(slots), [slots])
  const [activeDate, setActiveDate] = useState<string | null>(null)

  const selectedDay = days.find((d) => d.date === activeDate) ?? days[0] ?? null

  if (!days.length) {
    return (
      <div className="rounded-md border border-hair bg-paper p-5 text-[17px] leading-relaxed text-mute">
        {emptyLabel}
      </div>
    )
  }

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, { weekday: "short", day: "numeric", month: "short" }).format(
      new Date(`${iso}T00:00:00`),
    )

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-mute">{t("public.slots.pickDay")}</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          {days.map((day) => {
            const on = selectedDay?.date === day.date
            return (
              <button
                key={day.date}
                type="button"
                aria-pressed={on}
                onClick={() => setActiveDate(day.date)}
                className={cn(
                  "flex min-h-14 shrink-0 flex-col justify-center rounded-md border px-3.5 py-2 text-start transition-colors",
                  on ? "border-cobalt bg-cobalt text-white" : "border-hair bg-paper text-ink hover:bg-sunk",
                )}
              >
                <span className={cn("block text-[17px] leading-tight", on ? "font-bold" : "font-medium")}>
                  {dayLabel(day.date)}
                </span>
                <span className={cn("block text-sm tabular-nums", on ? "text-white/80" : "text-mute")}>
                  {t("public.slots.count", { count: day.slots.length })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay ? (
        <div>
          <p className="mb-2 text-sm font-medium text-mute">{t("public.slots.pickTime")}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectedDay.slots.map((slot) => (
              <button
                key={`${slot.date}-${slot.start}`}
                type="button"
                className="h-12 rounded-md border border-hair bg-paper text-[17px] font-medium tabular-nums text-ink transition-colors hover:border-cobalt hover:bg-cobalt-tint focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
                onClick={() => onPick(slot)}
                dir="ltr"
              >
                {slot.start}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
