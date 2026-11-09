"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  getDashboardVisitCount,
  subscribeDashboardVisitCount,
} from "@/lib/dashboard-visit-count"
import { localeToBcp47 } from "@/lib/format-locale"
import type { Locale } from "@/lib/i18n/types"

function dayParts(locale: Locale, d: Date) {
  const tag = localeToBcp47(locale)
  return {
    weekday: d.toLocaleDateString(tag, { weekday: "long" }),
    dayMonth: d.toLocaleDateString(tag, { day: "numeric", month: "short" }),
  }
}

/**
 * The day, on the plate: weekday and today's visit count as the label, the
 * date itself in display numerals beneath (DESIGN.md — the facts that matter
 * are read from across the room).
 */
export function HeaderBarDate() {
  const pathname = usePathname()
  const { locale, visitsToday, t } = useLocale()

  const [parts, setParts] = useState(() => dayParts(locale, new Date()))

  useEffect(() => {
    setParts(dayParts(locale, new Date()))
  }, [pathname, locale])

  const visitCount = useSyncExternalStore(
    subscribeDashboardVisitCount,
    getDashboardVisitCount,
    getDashboardVisitCount,
  )

  const isoDate = new Date().toISOString().slice(0, 10)

  // The date and the count are a summary of today's diary, so they open it.
  // The first thing the practitioner did with them was tap them.
  return (
    <Link
      href="/calendar"
      className="flex min-w-0 flex-col rounded-md text-white"
      title={t("header.openDiary")}
    >
      {/* The server renders this date in UTC and the browser in the clinic's
          own timezone, so the two disagree — by the formatting always, and by
          a whole day every evening. React reported it as a hydration failure
          on every page. The client's answer is the right one; this says so
          rather than leaving the mismatch to be discovered again. */}
      <span suppressHydrationWarning className="truncate text-sm text-white/80">
        {parts.weekday} · <span className="tabular-nums">{visitsToday(visitCount)}</span>
      </span>
      <time
        dateTime={isoDate}
        suppressHydrationWarning
        className="font-display text-[40px] leading-[0.95] tabular-nums sm:text-[56px]"
      >
        {parts.dayMonth}
      </time>
    </Link>
  )
}
