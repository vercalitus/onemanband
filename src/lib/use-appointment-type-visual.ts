"use client"

import { useSyncExternalStore } from "react"

import { appointmentTypeVisual } from "@/lib/appointment-types"
import {
  CLINIC_SETTINGS_KEY,
  mergeAppointmentTypeVisuals,
  readClinicSettings,
  type AppointmentTypeVisualRow,
} from "@/lib/clinic-settings-storage"
import type { AppointmentType } from "@/types/domain"

/** Stable server / first-paint snapshot — must stay referentially stable. */
const SERVER_VISUAL_SNAPSHOT = { ...appointmentTypeVisual } as Record<
  AppointmentType,
  AppointmentTypeVisualRow
>

let visualCache: Record<AppointmentType, AppointmentTypeVisualRow> | undefined
let visualCacheLsKey: string | undefined

function invalidateVisualCache() {
  visualCache = undefined
  visualCacheLsKey = undefined
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const handler = () => {
    invalidateVisualCache()
    onStoreChange()
  }
  window.addEventListener("clinic-settings-saved", handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener("clinic-settings-saved", handler)
    window.removeEventListener("storage", handler)
  }
}

/**
 * React requires getSnapshot to return the same reference when data hasn't
 * changed — otherwise useSyncExternalStore can infinite-loop or crash.
 */
function getSnapshot(): Record<AppointmentType, AppointmentTypeVisualRow> {
  let raw = ""
  try {
    raw = window.localStorage.getItem(CLINIC_SETTINGS_KEY) ?? ""
  } catch {
    raw = ""
  }
  if (visualCache !== undefined && raw === visualCacheLsKey) {
    return visualCache
  }
  visualCacheLsKey = raw
  visualCache = mergeAppointmentTypeVisuals(readClinicSettings())
  return visualCache
}

function getServerSnapshot(): Record<AppointmentType, AppointmentTypeVisualRow> {
  return SERVER_VISUAL_SNAPSHOT
}

/**
 * Live map of appointment type → calendar colors + labels, merged from clinic
 * settings when present. Subscribes to save events so scheduler updates
 * without a full refresh.
 */
export function useAppointmentTypeVisual(): Record<AppointmentType, AppointmentTypeVisualRow> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export { CLINIC_SETTINGS_KEY }
