"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  getDashboardVisitCount,
  subscribeDashboardVisitCount,
} from "@/lib/dashboard-visit-count"

/** Prominent full date on every route; visit count pill only on /dashboard. */
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

  const datePillClass =
    "max-w-[min(100%,28rem)] rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-sm font-bold leading-snug tracking-tight text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-100/80"

  if (isDashboard) {
    return (
      <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <time dateTime={isoDate} className={datePillClass}>
          {fullDate}
        </time>
        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums tracking-tight text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-emerald-100/90">
          {visitCount}&nbsp;
          <span className="font-semibold">{visitCount === 1 ? "visit" : "visits"}</span>
        </span>
      </div>
    )
  }

  return (
    <time dateTime={isoDate} className={`${datePillClass} hidden md:block`}>
      {fullDate}
    </time>
  )
}
