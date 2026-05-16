"use client"

import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type KpiTone = "neutral" | "warning" | "success"

const TONE_STYLES: Record<KpiTone, { iconBg: string; iconFg: string }> = {
  neutral: { iconBg: "bg-sky-50", iconFg: "text-sky-600" },
  warning: { iconBg: "bg-amber-50", iconFg: "text-amber-600" },
  success: { iconBg: "bg-emerald-50", iconFg: "text-emerald-600" },
}

/**
 * Big-number KPI card used at the top of the Financial OS page. Hierarchy:
 * eyebrow → giant mono number → optional trend / context line. Tone tints
 * only the small icon, never the number itself — keeps the card calm.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  delta,
  context,
  footer,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone?: KpiTone
  /** Percentage change vs. the previous period; positive = up arrow. */
  delta?: number | null
  /** Short context line under the value (e.g. "vs $1,180 last month"). */
  context?: string
  /** Optional element rendered at the bottom of the card (e.g. a progress bar). */
  footer?: ReactNode
}) {
  const tones = TONE_STYLES[tone]
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
            tones.iconBg,
            tones.iconFg,
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
            {context ? <span className="text-slate-500">{context}</span> : null}
          </div>
        ) : null}
      </div>

      {footer ? <div>{footer}</div> : null}
    </div>
  )
}
