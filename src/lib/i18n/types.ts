/** Supported locales; default is English unless user persists another choice. */
export type Locale = "en" | "he" | "ar"

/** Persists locale across sessions (explicit product choice — not inferred). */
export const LOCALE_STORAGE_KEY = "ob:locale"

export type Direction = "ltr" | "rtl"
