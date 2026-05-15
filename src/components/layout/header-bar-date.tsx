"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  getDashboardVisitCount,
  subscribeDashboardVisitCount,
} from "@/lib/dashboard-visit-count"

/** Full date + visit pill on /dashboard; compact date on other app routes. */
export function HeaderBarDate() {
  const pathname = usePathname()
  const isDashboard = pathname === "/dashboard"
  const [fullDate, setFullDate] = useState(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  )

  useEffect(() => {
    if (!isDashboard) return
    setFullDate(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    )
  }, [isDashboard])

  const visitCount = useSyncExternalStore(
    subscribeDashboardVisitCount,
    getDashboardVisitCount,
    getDashboardVisitCount,
  )

  const isoDate = new Date().toISOString().slice(0, 10)

  if (isDashboard) {
    return (
      <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <time
          dateTime={isoDate}
          className="max-w-[min(100%,28rem)] text-sm font-semibold leading-snug tracking-tight text-slate-800"
        >
          {fullDate}
        </time>
        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums tracking-tight text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-emerald-100/90">
          {visitCount}&nbsp;
          <span className="font-semibold">{visitCount === 1 ? "visit" : "visits"}</span>
        </span>
      </div>
    )
  }

  const shortFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  return (
    <time
      dateTime={isoDate}
      className="hidden text-sm font-semibold text-slate-800 lg:block"
    >
      {shortFormatted}
    </time>
  )
}
