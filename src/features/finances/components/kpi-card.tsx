"use client"

import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type KpiTone = "sky" | "amber" | "emerald"

const TONE_SHELL: Record<
  KpiTone,
  { outer: string; iconBg: string; iconFg: string; neutralBar: string }
> = {
  sky: {
    outer:
      "border-2 border-sky-200/85 bg-gradient-to-br from-sky-50/95 via-white to-white shadow-[0_8px_36px_-14px_rgba(56,189,248,0.35),0_2px_8px_rgba(15,23,42,0.04)]",
    iconBg: "bg-sky-100",
    iconFg: "text-sky-700",
    neutralBar: "from-sky-200 to-sky-500",
  },
  amber: {
    outer:
      "border-2 border-amber-200/85 bg-gradient-to-br from-amber-50/95 via-white to-white shadow-[0_8px_36px_-14px_rgba(245,158,11,0.28),0_2px_8px_rgba(15,23,42,0.04)]",
    iconBg: "bg-amber-100",
    iconFg: "text-amber-800",
    neutralBar: "from-amber-200 to-amber-500",
  },
  emerald: {
    outer:
      "border-2 border-emerald-200/85 bg-gradient-to-br from-emerald-50/95 via-white to-white shadow-[0_8px_36px_-14px_rgba(16,185,129,0.28),0_2px_8px_rgba(15,23,42,0.04)]",
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-800",
    neutralBar: "from-emerald-200 to-emerald-500",
  },
}

const DEFAULT_TONE: KpiTone = "sky"

/**
 * Big-number KPI card for Financial OS. Visually tiered surfaces (pastel wash +
 * thick border) so the top strip reads as a dashboard, not three white tiles.
 * When `footer` is set, the built-in intuition strip is omitted to avoid
 * duplicating a second progress bar.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  context,
  footer,
  contextMonospace = false,
  tone = DEFAULT_TONE,
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
  /** Pastel card family — sky / amber / emerald — for visual grouping at a glance. */
  tone?: KpiTone
}) {
  const shell = TONE_SHELL[tone]
  const hasDelta = typeof delta === "number"
  const positive = hasDelta && delta! >= 0
  const showInlineStrip = !footer

  return (
    <div className={cn("flex h-full flex-col justify-between gap-5 rounded-3xl p-5", shell.outer)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          {label}
        </p>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-white/70",
            shell.iconBg,
            shell.iconFg,
          )}
          aria-hidden
        >
          <Icon className="size-4 stroke-[1.75]" />
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
                  "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold ring-1",
                  positive
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200/90"
                    : "bg-rose-50 text-rose-700 ring-rose-200/90",
                )}
              >
                {positive ? (
                  <TrendingUp className="size-3 stroke-[1.75]" aria-hidden />
                ) : (
                  <TrendingDown className="size-3 stroke-[1.75]" aria-hidden />
                )}
                {positive ? "+" : ""}
                {delta}%
              </span>
            ) : null}
            {context ? (
              <span
                className={cn("text-slate-600", contextMonospace && "font-mono tabular-nums")}
              >
                {context}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {showInlineStrip ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-slate-200/60">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-[width] duration-500",
              hasDelta
                ? positive
                  ? "from-emerald-200 to-emerald-500"
                  : "from-rose-200 to-rose-500"
                : shell.neutralBar,
            )}
            style={{
              width: `${hasDelta ? Math.min(96, Math.max(18, 52 + (delta ?? 0))) : 68}%`,
            }}
            aria-hidden
          />
        </div>
      ) : null}

      {footer ? <div className="pt-0.5">{footer}</div> : null}
    </div>
  )
}
