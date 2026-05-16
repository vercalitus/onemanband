"use client"

import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Site-wide: KPI header icons stay sky blue (matches global accent). */
const KPI_ICON_BADGE = { iconBg: "bg-sky-50", iconFg: "text-sky-600" } as const

/**
 * Big-number KPI card used at the top of the Financial OS page. Hierarchy:
 * eyebrow → giant mono number → optional trend / context line. Icons match
 * the global accent (sky), not semantic warning/success colors.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  context,
  footer,
  contextMonospace = false,
}: {
  label: string
  value: string
  icon: LucideIcon
  /** Percentage change vs. the previous period; positive = up arrow. */
  delta?: number | null
  /** Short context line under the value (e.g. "vs $1,180 last month"). */
  context?: string
  /** Optional element rendered at the bottom of the card (e.g. a progress bar). */
  footer?: ReactNode
  /** When true, context line uses tabular mono (currency comparisons). */
  contextMonospace?: boolean
}) {
  const hasDelta = typeof delta === "number"
  const positive = hasDelta && delta! >= 0

  return (
    <div className="flex h-full flex-col justify-between gap-5 rounded-2xl bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            KPI_ICON_BADGE.iconBg,
            KPI_ICON_BADGE.iconFg,
          )}
          aria-hidden
        >
          <Icon className="size-4 stroke-[1.8]" />
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-slate-900">
          {value}
        </p>
        {hasDelta || context ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {hasDelta ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold",
                  positive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-600",
                )}
              >
                {positive ? (
                  <TrendingUp className="size-3 stroke-[2.4]" aria-hidden />
                ) : (
                  <TrendingDown className="size-3 stroke-[2.4]" aria-hidden />
                )}
                {positive ? "+" : ""}
                {delta}%
              </span>
            ) : null}
            {context ? (
              <span
                className={cn("text-slate-500", contextMonospace && "font-mono tabular-nums")}
              >
                {context}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {footer ? <div>{footer}</div> : null}
    </div>
  )
}
