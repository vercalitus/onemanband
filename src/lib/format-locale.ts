import type { Locale } from "@/lib/i18n/types"
import { formatIls } from "@/lib/format-ils"

const EN_TAG = "en-US"
const HE_TAG = "he-IL"

export function localeToBcp47(locale: Locale): string {
  return locale === "he" ? HE_TAG : EN_TAG
}

/**
 * Monetary display: Hebrew uses ₪ formatting (matches clinic pricing tooling);
 * English keeps legacy mock "$" shorthand for seeded demo rows.
 */
export function formatMoney(value: number, locale: Locale): string {
  if (locale === "he") return formatIls(value)
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString(EN_TAG, { maximumFractionDigits: 0 })
  return `${sign}$${formatted}`
}

/** Parse mock balance strings such as "$120", "$460", "$0". */
export function parseMockBalanceToNumber(raw: string): number {
  const n = Number.parseFloat(raw.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function formatDashboardDate(locale: Locale, date: Date = new Date()): string {
  return date.toLocaleDateString(localeToBcp47(locale), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

/** Visits subtitle in header — plural rules per locale. */
export function formatVisitsTodayLabel(locale: Locale, count: number): string {
  if (locale === "he") {
    if (count === 1) return "ביקור אחד היום"
    return `${count} ביקורים היום`
  }
  return count === 1 ? "1 visit today" : `${count} visits today`
}

export function formatRelativeSince(iso: string, locale: Locale): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const diffSec = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  const rtf = new Intl.RelativeTimeFormat(localeToBcp47(locale), { numeric: "auto" })
  if (abs < 60) return rtf.format(diffSec, "second")
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour")
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day")
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 604800), "week")
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month")
  return rtf.format(Math.round(diffSec / 31536000), "year")
}
