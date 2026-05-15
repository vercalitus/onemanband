"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  getDashboardVisitCount,
  subscribeDashboardVisitCount,
} from "@/lib/dashboard-visit-count"

/** Full date + today’s visit count pill on every app route (count synced from dashboard calendar when present). */
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

  /** One shared token set so date + visits read as matched chips (same fill + type color). */
  const emeraldChipClass =
    "border border-emerald-200 bg-emerald-100/85 text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-emerald-200/80"

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
      <time
        dateTime={isoDate}
        className={`max-w-[min(100%,28rem)] rounded-xl px-3 py-1.5 ${emeraldChipClass} text-sm font-bold leading-snug tracking-tight`}
      >
        {fullDate}
      </time>
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 ${emeraldChipClass} text-xs font-bold tabular-nums tracking-tight`}
      >
        {visitCount}&nbsp;
        <span className="font-semibold">{visitCount === 1 ? "visit" : "visits"}</span>
      </span>
    </div>
  )
}
