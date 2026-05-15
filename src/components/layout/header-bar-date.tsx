"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  getDashboardVisitCount,
  subscribeDashboardVisitCount,
} from "@/lib/dashboard-visit-count"

/**
 * Dashboard visit count stays in sync when the day calendar edits; typography only (no pills).
 * Example: Friday, 15 May 2026 | 16 visits today
 */
export function HeaderBarDate() {
  const pathname = usePathname()
  const [fullDate, setFullDate] = useState(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  )

  useEffect(() => {
    setFullDate(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    )
  }, [pathname])

  const visitCount = useSyncExternalStore(
    subscribeDashboardVisitCount,
    getDashboardVisitCount,
    getDashboardVisitCount,
  )

  const isoDate = new Date().toISOString().slice(0, 10)
  const visitsLabel =
    visitCount === 1 ? `${visitCount} visit today` : `${visitCount} visits today`

  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <time dateTime={isoDate} className="text-sm font-medium tracking-tight text-sky-700">
        {fullDate}
      </time>
      <span className="select-none text-sky-300" aria-hidden>
        |
      </span>
      <span className="text-xs font-medium tabular-nums tracking-tight text-slate-500">{visitsLabel}</span>
    </div>
  )
}
