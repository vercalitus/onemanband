"use client"

import type { ReactNode } from "react"

import { PlateFact } from "@/components/layout/page-plate"

/**
 * One billing figure on the plate (DESIGN.md): label, value, and an optional
 * line of context under it. These used to be three cards with icons and a
 * decorative progress strip; on the plate the number is the whole message.
 *
 * Only what the page has computed goes here — never a figure from the demo
 * file while the ledger is real (AGENTS.md).
 */
export function KpiCard({
  label,
  value,
  display,
  delta,
  context,
}: {
  label: string
  value: string
  /** Poster-size numerals — the one figure the screen is for. */
  display?: boolean
  /** Percentage change vs. the previous period. */
  delta?: number | null
  /** Short context line under the value (e.g. "vs ₪1,180 last month"). */
  context?: ReactNode
}) {
  const hasDelta = typeof delta === "number"
  return (
    <div className="flex min-w-0 flex-col">
      <PlateFact label={label} display={display}>
        {value}
      </PlateFact>
      {hasDelta || context ? (
        <span className="mt-1.5 truncate text-sm text-white/80 tabular-nums">
          {hasDelta ? (
            <span className="font-bold text-white">
              {delta! >= 0 ? "+" : "−"}
              {Math.abs(delta!)}%
            </span>
          ) : null}
          {hasDelta && context ? " · " : null}
          {context}
        </span>
      ) : null}
    </div>
  )
}
