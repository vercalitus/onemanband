"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { createTranslator, type TranslateFn } from "@/lib/i18n/dictionary"
import {
  isRtlLocale,
  localeToDirection,
  localeToHtmlLang,
  parseStoredLocale,
} from "@/lib/i18n/locale-utils"
import type { Direction, Locale } from "@/lib/i18n/types"
import { LOCALE_STORAGE_KEY } from "@/lib/i18n/types"
import {
  formatDashboardDate,
  formatMoney as formatMoneyFmt,
  formatRelativeSince,
  localeToBcp47,
  parseMockBalanceToNumber,
  formatVisitsTodayLabel as visitsTodayFmt,
} from "@/lib/format-locale"
import { cn } from "@/lib/utils"

type LocaleContextValue = {
  locale: Locale
  dir: Direction
  isRtl: boolean
  localeTag: string
  setLocale: (next: Locale) => void
  t: TranslateFn
  formatMoney: (value: number) => string
  formatBalanceDisplay: (raw: string) => string
  formatPageDate: (date?: Date) => string
  formatRelative: (iso: string) => string
  visitsToday: (count: number) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale requires LocaleProvider")
  return ctx
}

/**
 * Persisted trilingual shell: drives `lang`/`dir`, locale fonts from CSS,
 * subtle opacity easing when switching languages.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [locale, setLocaleState] = useState<Locale>("en")
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = parseStoredLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
      if (saved) setLocaleState(saved)
    } catch {
      /**/
    }
  }, [])

  const persistDom = useCallback((next: Locale) => {
    const dir = localeToDirection(next)
    const root = document.documentElement
    root.lang = localeToHtmlLang(next)
    root.dir = dir
    root.dataset.locale = next
    document.body.dataset.locale = next
    document.body.dataset.dir = dir
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /**/
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    persistDom(locale)
  }, [mounted, locale, persistDom])

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return
      setBlink(true)
      window.setTimeout(() => {
        setLocaleState(next)
        persistDom(next)
        window.setTimeout(() => setBlink(false), 180)
      }, 120)
    },
    [locale, persistDom],
  )

  const t = useMemo(() => createTranslator(locale), [locale])
  const localeTag = useMemo(() => localeToBcp47(locale), [locale])
  const dir = localeToDirection(locale)
  const isRtl = isRtlLocale(locale)

  const formatMoney = useCallback((n: number) => formatMoneyFmt(n, locale), [locale])

  const formatBalanceDisplay = useCallback(
    (raw: string) => formatMoney(parseMockBalanceToNumber(raw)),
    [formatMoney],
  )

  const formatPageDate = useCallback(
    (d = new Date()) => formatDashboardDate(locale, d),
    [locale],
  )

  const formatRelative = useCallback((iso: string) => formatRelativeSince(iso, locale), [locale])

  const visitsToday = useCallback((c: number) => visitsTodayFmt(locale, c), [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir,
      isRtl,
      localeTag,
      setLocale,
      t,
      formatMoney,
      formatBalanceDisplay,
      formatPageDate,
      formatRelative,
      visitsToday,
    }),
    [
      locale,
      dir,
      isRtl,
      localeTag,
      setLocale,
      t,
      formatMoney,
      formatBalanceDisplay,
      formatPageDate,
      formatRelative,
      visitsToday,
    ],
  )

  return (
    <LocaleContext.Provider value={value}>
      <div
        data-locale-dimmer={blink ? "1" : "0"}
        className={cn(
          "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none motion-reduce:duration-0",
          blink ? "motion-safe:opacity-[0.9]" : "opacity-100",
        )}
      >
        {children}
      </div>
    </LocaleContext.Provider>
  )
}
