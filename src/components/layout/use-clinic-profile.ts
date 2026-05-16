"use client"

import { useSyncExternalStore } from "react"

import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { ClinicProfile } from "@/types/clinic-settings"

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const fn = () => onChange()
  window.addEventListener("clinic-settings-saved", fn)
  window.addEventListener("storage", fn)
  return () => {
    window.removeEventListener("clinic-settings-saved", fn)
    window.removeEventListener("storage", fn)
  }
}

function getSnapshot(): ClinicProfile {
  return readClinicSettings().profile
}

function getServerSnapshot(): ClinicProfile {
  return createDefaultClinicSettings().profile
}

/** Live clinic name + logo for the sidebar from persisted settings. */
export function useClinicProfile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
