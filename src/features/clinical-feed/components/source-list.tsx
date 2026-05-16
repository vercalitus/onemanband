"use client"

import { Library, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ClinicalSource } from "@/types/domain"

/**
 * Vertical list of sources powering the sidebar filter. Clicking a row scopes
 * the feed to that source; the "All sources" pseudo-row clears the filter.
 * Designed for many sources — no horizontal pills that would overflow.
 */
export function SourceList({
  sources,
  articleCountBySource,
  totalCount,
  selectedSourceId,
  onSelect,
  onRemoveCustom,
}: {
  sources: ClinicalSource[]
  articleCountBySource: Map<string, number>
  totalCount: number
  selectedSourceId: string | null
  onSelect: (id: string | null) => void
  onRemoveCustom: (id: string) => void
}) {
  return (
    <ul className="flex flex-col gap-0.5" role="list">
      <SourceRow
        label="All sources"
        count={totalCount}
        active={selectedSourceId === null}
        onClick={() => onSelect(null)}
        leading={<Library className="size-3.5 stroke-[1.8] text-sky-600" aria-hidden />}
      />

      <li className="my-1 h-px bg-slate-100" aria-hidden />

      {sources.map((s) => {
        const active = selectedSourceId === s.id
        const count = articleCountBySource.get(s.id) ?? 0
        return (
          <SourceRow
            key={s.id}
            label={s.name}
            sublabel={s.url ? s.url.replace(/^https?:\/\//, "") : undefined}
            count={count}
            active={active}
            onClick={() => onSelect(s.id)}
            trailing={
              s.custom ? (
                <button
                  type="button"
                  className="ml-1 rounded-md p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${s.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveCustom(s.id)
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
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
  leading,
  trailing,
}: {
  label: string
  sublabel?: string
  count: number
  active: boolean
  onClick: () => void
  leading?: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
          active ? "bg-sky-50 text-sky-900" : "text-slate-700 hover:bg-slate-50",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center",
            !leading && (active ? "text-sky-600" : "text-slate-300"),
          )}
          aria-hidden
        >
          {leading ?? <span className="size-1.5 rounded-full bg-current" />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm",
              active ? "font-semibold" : "font-medium",
            )}
          >
            {label}
          </span>
          {sublabel ? (
            <span className="block truncate text-[11px] text-slate-400">{sublabel}</span>
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 text-[11px] font-semibold tabular-nums",
            active ? "text-sky-700" : "text-slate-400",
          )}
        >
          {count}
        </span>
        {trailing}
      </button>
    </li>
  )
}
