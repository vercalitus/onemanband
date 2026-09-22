"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import { fetchClinicName } from "@/lib/clinic-repository"
import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import { CLINIC_SETTINGS_KEY, readClinicSettings } from "@/lib/clinic-settings-storage"
import type { ClinicProfile } from "@/types/clinic-settings"

const SERVER_PROFILE_SNAPSHOT: ClinicProfile = createDefaultClinicSettings().profile

let profileCache: ClinicProfile | undefined
let profileCacheLsKey: string | undefined

function invalidateProfileCache() {
  profileCache = undefined
  profileCacheLsKey = undefined
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const fn = () => {
    invalidateProfileCache()
    onChange()
  }
  window.addEventListener("clinic-settings-saved", fn)
  window.addEventListener("storage", fn)
  return () => {
    window.removeEventListener("clinic-settings-saved", fn)
    window.removeEventListener("storage", fn)
  }
}

function getSnapshot(): ClinicProfile {
  let raw = ""
  try {
    raw = window.localStorage.getItem(CLINIC_SETTINGS_KEY) ?? ""
  } catch {
    raw = ""
  }
  if (profileCache !== undefined && raw === profileCacheLsKey) {
    return profileCache
  }
  profileCacheLsKey = raw
  profileCache = readClinicSettings().profile
  return profileCache
}

function getServerSnapshot(): ClinicProfile {
  return SERVER_PROFILE_SNAPSHOT
}

/**
 * Live clinic name + logo for the sidebar.
 *
 * The logo and any name the practitioner typed come from settings; a clinic
 * that has never been named falls back to its own row in the database, which
 * is where its name actually lives.
 */
export function useClinicProfile() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [liveName, setLiveName] = useState<string | null>(null)
  useEffect(() => {
    if (stored.clinicName) return
    let cancelled = false
    void fetchClinicName().then((name) => {
      if (!cancelled) setLiveName(name)
    })
    return () => {
      cancelled = true
    }
  }, [stored.clinicName])

  return stored.clinicName || !liveName ? stored : { ...stored, clinicName: liveName }
}
