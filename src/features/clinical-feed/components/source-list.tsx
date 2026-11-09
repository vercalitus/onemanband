"use client"

import { Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import type { ClinicalSource } from "@/types/domain"

/**
 * Vertical list powering the sidebar: Saved → All sources → per-source rows.
 * Clicking Saved scopes the feed to bookmarked articles; All sources restores
 * the full feed before optional per-source narrowing.
 *
 * `layout="row"` draws the same choices as one scrolling line of chips, for a
 * screen too narrow to give the list its own column.
 */
export function SourceList({
  sources,
  articleCountBySource,
  totalCount,
  selectedSourceId,
  showSavedOnly,
  savedCount,
  onSelectSaved,
  onSelectAllSources,
  onSelectSource,
  onRemoveCustom,
  layout = "column",
}: {
  sources: ClinicalSource[]
  articleCountBySource: Map<string, number>
  totalCount: number
  selectedSourceId: string | null
  showSavedOnly: boolean
  savedCount: number
  onSelectSaved: () => void
  onSelectAllSources: () => void
  onSelectSource: (id: string) => void
  onRemoveCustom: (id: string) => void
  layout?: "column" | "row"
}) {
  const { t } = useLocale()
  const row = layout === "row"

  const items = [
    { key: "saved", label: t("clinical.source.saved"), count: savedCount, active: showSavedOnly, onClick: onSelectSaved, divideAfter: true },
    {
      key: "all",
      label: t("clinical.source.allSources"),
      count: totalCount,
      active: !showSavedOnly && selectedSourceId === null,
      onClick: onSelectAllSources,
      divideAfter: true,
    },
  ]

  return (
    <ul
      className={cn(
        row
          ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
          : "flex flex-col gap-0.5",
      )}
      role="list"
    >
      {items.map((it) => (
        <SourceRow
          key={it.key}
          row={row}
          label={it.label}
          count={it.count}
          active={it.active}
          onClick={it.onClick}
          className={!row && it.divideAfter ? "mb-1.5 border-b border-hair pb-1.5" : undefined}
        />
      ))}

      {sources.map((s) => {
        const active = !showSavedOnly && selectedSourceId === s.id
        const count = articleCountBySource.get(s.id) ?? 0
        return (
          <SourceRow
            key={s.id}
            row={row}
            label={s.name}
            sublabel={!row && s.url ? s.url.replace(/^https?:\/\//, "") : undefined}
            count={count}
            active={active}
            onClick={() => onSelectSource(s.id)}
            trailing={
              s.custom ? (
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-mute transition-colors hover:bg-sunk hover:text-ink"
                  aria-label={t("clinical.source.remove", { name: s.name })}
                  onClick={() => onRemoveCustom(s.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null
            }
          />
        )
      })}
    </ul>
  )
}

function SourceRow({
  label,
  sublabel,
  count,
  active,
  onClick,
  trailing,
  row,
  className,
}: {
  label: string
  sublabel?: string
  count: number
  active: boolean
  onClick: () => void
  trailing?: React.ReactNode
  row: boolean
  className?: string
}) {
  if (row) {
    return (
      <li className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors",
            active ? "border-cobalt bg-cobalt font-bold text-white" : "border-hair bg-paper text-ink hover:bg-ground",
          )}
        >
          {label}
          <span className={cn("tabular-nums", active ? "text-white/80" : "text-mute")}>{count}</span>
        </button>
        {trailing}
      </li>
    )
  }

  return (
    <li className={cn("flex items-center", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-start transition-colors",
          // Cobalt is the selected state (DESIGN.md), the same fill the rail and chips use.
          active ? "bg-cobalt text-white" : "text-ink hover:bg-ground",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[17px] leading-snug", active ? "font-bold" : "font-medium")}>
            {label}
          </span>
          {sublabel ? (
            <span className={cn("block truncate text-[13px]", active ? "text-white/80" : "text-mute")}>{sublabel}</span>
          ) : null}
        </span>
        <span className={cn("shrink-0 text-sm tabular-nums", active ? "text-white/80" : "text-mute")}>{count}</span>
      </button>
      {trailing}
    </li>
  )
}
