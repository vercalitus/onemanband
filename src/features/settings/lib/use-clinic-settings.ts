"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import {
  applyLocaleClinicOverlay,
  invertLocaleClinicOverlay,
} from "@/lib/i18n/localized-clinic-settings"
import { readClinicSettings, writeClinicSettings } from "@/lib/clinic-settings-storage"
import type { ClinicSettings } from "@/types/clinic-settings"

function stableStringify(s: ClinicSettings): string {
  return JSON.stringify(s)
}

export function useClinicSettings() {
  const { locale } = useLocale()
  const [settings, setSettings] = useState<ClinicSettings>(createDefaultClinicSettings)
  const [baseline, setBaseline] = useState<ClinicSettings | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const raw = readClinicSettings()
    const view = applyLocaleClinicOverlay(raw, locale)
    setSettings(view)
    setBaseline(view)
    setHydrated(true)
  }, [locale])

  const isDirty = useMemo(() => {
    if (!baseline) return false
    return stableStringify(settings) !== stableStringify(baseline)
  }, [settings, baseline])

  const save = useCallback(() => {
    const toStore = invertLocaleClinicOverlay(settings, locale)
    writeClinicSettings(toStore)
    setBaseline(settings)
  }, [settings, locale])

  const discard = useCallback(() => {
    if (baseline) setSettings(baseline)
  }, [baseline])

  return {
    settings,
    setSettings,
    isDirty,
    save,
    discard,
    hydrated,
  }
}
