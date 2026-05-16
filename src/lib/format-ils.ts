/**
 * Display helpers for shekel amounts in Settings and billing rows that
 * originate from clinic pricing (Israeli currency).
 */
export function formatIls(amount: number): string {
  const n = Math.round(amount)
  const formatted = Math.abs(n).toLocaleString("he-IL", { maximumFractionDigits: 0 })
  return n < 0 ? `-₪${formatted}` : `₪${formatted}`
}

/** Parses user text like "1,200" or "1200" into an integer agorot aren't used */
export function parseIlsInput(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, "").replace(/^-$/, "")
  if (!cleaned || cleaned === "-") return 0
  const n = Number.parseInt(cleaned, 10)
  return Number.isFinite(n) ? n : 0
}
