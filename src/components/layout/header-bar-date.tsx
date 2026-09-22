"use client"

import Link from "next/link"
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
  const { formatPageDate, visitsToday, t } = useLocale()

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

  // The date and the count are a summary of today's diary, so they open it.
  // The first thing the practitioner did with them was tap them.
  return (
    <Link
      href="/calendar"
      className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md transition-colors hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
      title={t("header.openDiary")}
    >
      {/* The server renders this date in UTC and the browser in the clinic's
          own timezone, so the two disagree — by the formatting always, and by
          a whole day every evening. React reported it as a hydration failure
          on every page. The client's answer is the right one; this says so
          rather than leaving the mismatch to be discovered again. */}
      <time
        dateTime={isoDate}
        suppressHydrationWarning
        className="text-base font-semibold tracking-tight text-sky-700"
      >
        {fullDate}
      </time>
      <span className="select-none text-sm font-semibold text-sky-400" aria-hidden>
        |
      </span>
      <span className="text-sm font-semibold tabular-nums tracking-tight text-sky-700">{visitsLabel}</span>
    </Link>
  )
}
