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

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const handler = () => onStoreChange()
  window.addEventListener("clinic-settings-saved", handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener("clinic-settings-saved", handler)
    window.removeEventListener("storage", handler)
  }
}

function getSnapshot(): Record<AppointmentType, AppointmentTypeVisualRow> {
  return mergeAppointmentTypeVisuals(readClinicSettings())
}

function getServerSnapshot(): Record<AppointmentType, AppointmentTypeVisualRow> {
  return { ...appointmentTypeVisual } as Record<AppointmentType, AppointmentTypeVisualRow>
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
