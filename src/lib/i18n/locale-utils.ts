import type { Direction, Locale } from "@/lib/i18n/types"

/** Hebrew and Arabic both use right-to-left layout. */
export function isRtlLocale(locale: Locale): boolean {
  return locale === "he" || locale === "ar"
}

/** Demo seed overlays apply for any non-English UI locale. */
export function isLocalizedSeedLocale(locale: Locale): boolean {
  return locale === "he" || locale === "ar"
}

export function localeToHtmlLang(locale: Locale): string {
  if (locale === "he") return "he"
  if (locale === "ar") return "ar"
  return "en"
}

export function localeToDirection(locale: Locale): Direction {
  return isRtlLocale(locale) ? "rtl" : "ltr"
}

const SUPPORTED: Locale[] = ["en", "he", "ar"]

export function parseStoredLocale(raw: string | null): Locale | null {
  if (raw === "en" || raw === "he" || raw === "ar") return raw
  return null
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED as string[]).includes(value)
}
