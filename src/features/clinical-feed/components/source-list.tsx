"use client"

import { BookOpen, BookmarkCheck, Library, Trash2 } from "lucide-react"
import type { ReactNode } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import type { ClinicalSource } from "@/types/domain"

/**
 * Vertical list powering the sidebar: Saved → All sources → per-source rows.
 * Clicking Saved scopes the feed to bookmarked articles; All sources restores
 * the full feed before optional per-source narrowing.
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
}) {
  const { t } = useLocale()

  return (
    <ul className="flex flex-col gap-0.5" role="list">
      <SourceRow
        label={t("clinical.source.saved")}
        count={savedCount}
        active={showSavedOnly}
        onClick={onSelectSaved}
        leading={<BookmarkCheck className="size-4 stroke-[1.8]" aria-hidden />}
      />

      <li className="my-1 h-px bg-slate-100" aria-hidden />

      <SourceRow
        label={t("clinical.source.allSources")}
        count={totalCount}
        active={!showSavedOnly && selectedSourceId === null}
        onClick={onSelectAllSources}
        leading={<Library className="size-4 stroke-[1.8]" aria-hidden />}
      />

      <li className="my-1 h-px bg-slate-100" aria-hidden />

      {sources.map((s) => {
        const active = !showSavedOnly && selectedSourceId === s.id
        const count = articleCountBySource.get(s.id) ?? 0
        return (
          <SourceRow
            key={s.id}
            label={s.name}
            sublabel={s.url ? s.url.replace(/^https?:\/\//, "") : undefined}
            count={count}
            active={active}
            onClick={() => onSelectSource(s.id)}
            leading={<BookOpen className="size-4 stroke-[1.8]" aria-hidden />}
            trailing={
              s.custom ? (
                <button
                  type="button"
                  className={cn(
                    "ml-1 rounded-md p-1 transition-colors",
                    active
                      ? "text-white/60 hover:bg-white/10 hover:text-white"
                      : "text-slate-300 hover:bg-rose-50 hover:text-rose-600",
                  )}
                  aria-label={t("clinical.source.remove", { name: s.name })}
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
  leading?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
          active
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-700 hover:bg-slate-50",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
            active ? "bg-white/10 text-sky-300" : "bg-slate-50 text-sky-600 group-hover:bg-white",
          )}
          aria-hidden
        >
          {leading}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm",
              active ? "font-semibold text-white" : "font-medium text-slate-800",
            )}
          >
            {label}
          </span>
          {sublabel ? (
            <span
              className={cn(
                "block truncate text-[11px]",
                active ? "text-white/60" : "text-slate-400",
              )}
            >
              {sublabel}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-white/10 text-white" : "text-slate-400",
          )}
        >
          {count}
        </span>
        {trailing}
      </button>
    </li>
  )
}
