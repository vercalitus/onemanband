import type { Locale } from "@/lib/i18n/types"
import { EN_MESSAGES } from "@/lib/i18n/translations-en"
import { HE_MESSAGES } from "@/lib/i18n/translations-he"

/** English is authoritative — Hebrew overlays only supplied keys. */
const EN_FLAT = EN_MESSAGES as Record<string, string>
const HE_MERGED = { ...EN_FLAT, ...HE_MESSAGES }

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number | undefined>,
) => string

/** Build a translator; missing Hebrew keys fall back to English. */
export function createTranslator(locale: Locale): TranslateFn {
  const table = locale === "he" ? HE_MERGED : EN_FLAT
  return function t(key, params): string {
    let s = table[key] ?? EN_FLAT[key]
    if (s === undefined) {
      if (process.env.NODE_ENV === "development") console.warn("[i18n] missing:", key)
      return key
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue
        s = s.replaceAll(`{${k}}`, String(v))
      }
    }
    return s
  }
}
