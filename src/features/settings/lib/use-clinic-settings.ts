"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { fetchClinicName } from "@/lib/clinic-repository"
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

    // A clinic that has never been named here shows the name on its own
    // record, so the field reads what the sidebar and the patient pages read.
    // Into the baseline too: a name nobody typed is not an unsaved change.
    if (view.profile.clinicName) return
    let cancelled = false
    void fetchClinicName().then((name) => {
      if (cancelled || !name) return
      const withName = (s: ClinicSettings) => ({
        ...s,
        profile: { ...s.profile, clinicName: name },
      })
      setSettings((s) => (s.profile.clinicName ? s : withName(s)))
      setBaseline((s) => (s && !s.profile.clinicName ? withName(s) : s))
    })
    return () => {
      cancelled = true
    }
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
