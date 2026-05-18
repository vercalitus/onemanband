/** Supported locales; default is English unless user persists Hebrew. */
export type Locale = "en" | "he"

/** Persists locale across sessions (explicit product choice — not inferred). */
export const LOCALE_STORAGE_KEY = "ob:locale"

export type Direction = "ltr" | "rtl"
