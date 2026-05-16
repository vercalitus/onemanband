"use client"

import { useSyncExternalStore } from "react"

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

/** Live clinic name + logo for the sidebar from persisted settings. */
export function useClinicProfile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
