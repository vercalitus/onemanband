"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  getDashboardVisitCount,
  subscribeDashboardVisitCount,
} from "@/lib/dashboard-visit-count"

/** Header subtitle: long date + “N visits today” follow active locale */
export function HeaderBarDate() {
  const pathname = usePathname()
  const { formatPageDate, visitsToday } = useLocale()

  const [fullDate, setFullDate] = useState(() => formatPageDate(new Date()))

  useEffect(() => {
    setFullDate(formatPageDate(new Date()))
  }, [pathname, formatPageDate])

  const visitCount = useSyncExternalStore(
    subscribeDashboardVisitCount,
    getDashboardVisitCount,
    getDashboardVisitCount,
  )

  const isoDate = new Date().toISOString().slice(0, 10)
  const visitsLabel = visitsToday(visitCount)

  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <time dateTime={isoDate} className="text-base font-semibold tracking-tight text-sky-700">
        {fullDate}
      </time>
      <span className="select-none text-sm font-semibold text-sky-400" aria-hidden>
        |
      </span>
      <span className="text-sm font-semibold tabular-nums tracking-tight text-sky-700">{visitsLabel}</span>
    </div>
  )
}
