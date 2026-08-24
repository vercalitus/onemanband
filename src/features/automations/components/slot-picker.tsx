"use client"

import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        {emptyLabel}
      </div>
    )
  }

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, { weekday: "short", day: "numeric", month: "short" }).format(
      new Date(`${iso}T00:00:00`),
    )

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t("public.slots.pickDay")}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => setActiveDate(day.date)}
              className={cn(
                "shrink-0 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors",
                selectedDay?.date === day.date
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300",
              )}
            >
              <span className="block">{dayLabel(day.date)}</span>
              <span className="block text-xs font-medium opacity-75">
                {t("public.slots.count", { count: day.slots.length })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedDay ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t("public.slots.pickTime")}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectedDay.slots.map((slot) => (
              <Button
                key={`${slot.date}-${slot.start}`}
                variant="outline"
                className="h-11 border-slate-200 font-mono tabular-nums text-slate-800 hover:border-sky-300"
                onClick={() => onPick(slot)}
              >
                {slot.start}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
