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

  /** Shared emerald chrome for date + visits pills (radii applied per pill). */
  const emeraldSurfaceClass =
    "border border-emerald-200/90 bg-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-emerald-100/90"

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
      <time
        dateTime={isoDate}
        className={`max-w-[min(100%,28rem)] rounded-xl px-3 py-1.5 ${emeraldSurfaceClass} text-sm font-bold leading-snug tracking-tight text-emerald-950`}
      >
        {fullDate}
      </time>
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 ${emeraldSurfaceClass} text-xs font-bold tabular-nums tracking-tight text-emerald-900`}
      >
        {visitCount}&nbsp;
        <span className="font-semibold">{visitCount === 1 ? "visit" : "visits"}</span>
      </span>
    </div>
  )
}
