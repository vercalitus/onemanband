"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { SpineChart } from "@/features/body-map/components/spine-chart"
import { spineLabel } from "@/features/body-map/lib/regions"
import { cn } from "@/lib/utils"

/** One colour: everything marked here is the same thing, "worked on today". */
const MARKED = "#9FB4E3"

/**
 * Where on the spine this session's work was done.
 *
 * The practitioner used to write "C2 left" in every note. Asked what he wanted
 * instead, he answered in his own words: the spine model in each note, and a
 * touch on the area worked on. So this is the body map's flat spine, the same
 * drawing and the same taps, but its marks belong to the visit rather than to
 * the patient — they are saved with the treatment row and never change after.
 *
 * Closed, it is one line saying what is marked, so the writing canvas above it
 * keeps the screen.
 */
export function SessionSpine({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (item: string) => void
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const colors = useMemo(() => new Map(selected.map((item) => [item, MARKED])), [selected])
  const summary = selected.map((item) => spineLabel(t, item)).join(" · ")

  return (
    <div className="rounded-md border border-hair">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-[17px] transition-colors hover:bg-ground"
        aria-expanded={open}
        aria-controls="session-spine-panel"
      >
        <span className="shrink-0 font-bold text-ink">{t("patientChart.spine.title")}</span>
        <span
          className={cn(
            "min-w-0 truncate font-medium",
            selected.length ? "font-bold text-cobalt" : "text-faint",
          )}
        >
          {summary || t("patientChart.spine.none")}
        </span>
        {open ? (
          <ChevronUp className="ms-auto size-5 shrink-0 text-mute" aria-hidden />
        ) : (
          <ChevronDown className="ms-auto size-5 shrink-0 text-mute" aria-hidden />
        )}
      </button>

      {open && (
        <div id="session-spine-panel" className="border-t border-hair-soft p-4">
          <SpineChart colors={colors} selected={selected} onToggle={onToggle} arrangement="side" />
        </div>
      )}
    </div>
  )
}
