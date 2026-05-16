"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import { readClinicSettings, writeClinicSettings } from "@/lib/clinic-settings-storage"
import type { ClinicSettings } from "@/types/clinic-settings"

function stableStringify(s: ClinicSettings): string {
  return JSON.stringify(s)
}

export function useClinicSettings() {
  const [settings, setSettings] = useState<ClinicSettings>(createDefaultClinicSettings)
  const [baseline, setBaseline] = useState<ClinicSettings | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const s = readClinicSettings()
    setSettings(s)
    setBaseline(s)
    setHydrated(true)
  }, [])

  const isDirty = useMemo(() => {
    if (!baseline) return false
    return stableStringify(settings) !== stableStringify(baseline)
  }, [settings, baseline])

  const save = useCallback(() => {
    writeClinicSettings(settings)
    setBaseline(settings)
  }, [settings])

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
