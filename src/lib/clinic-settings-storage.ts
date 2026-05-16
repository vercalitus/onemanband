import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import { appointmentTypeVisual } from "@/lib/appointment-types"
import type { AppointmentType } from "@/types/domain"
import type { ClinicSettings, TreatmentColorPreset } from "@/types/clinic-settings"

export const CLINIC_SETTINGS_KEY = "clinic.settings.v1"

/** Maps color preset → card visuals (same language as `appointmentTypeVisual`). */
export const TREATMENT_COLOR_PRESET_VISUAL: Record<
  TreatmentColorPreset,
  { stripe: string; surface: string; chip: string }
> = {
  violet: {
    stripe: "border-l-4 border-violet-300",
    surface: "border-violet-200/80 bg-violet-50/80",
    chip: "border-violet-200 bg-violet-100/80 text-violet-700",
  },
  emerald: {
    stripe: "border-l-4 border-emerald-300",
    surface: "border-emerald-200/80 bg-emerald-50/80",
    chip: "border-emerald-200 bg-emerald-100/80 text-emerald-700",
  },
  amber: {
    stripe: "border-l-4 border-amber-300",
    surface: "border-amber-200/80 bg-amber-50/80",
    chip: "border-amber-200 bg-amber-100/80 text-amber-800",
  },
  sky: {
    stripe: "border-l-4 border-sky-300",
    surface: "border-sky-200/80 bg-sky-50/85",
    chip: "border-sky-200 bg-sky-100/90 text-sky-800",
  },
  rose: {
    stripe: "border-l-4 border-rose-300",
    surface: "border-rose-200/80 bg-rose-50/85",
    chip: "border-rose-200 bg-rose-100/90 text-rose-800",
  },
}

export type AppointmentTypeVisualRow = {
  stripe: string
  surface: string
  chip: string
  label: string
}

export function mergeAppointmentTypeVisuals(
  settings: ClinicSettings | null,
): Record<AppointmentType, AppointmentTypeVisualRow> {
  const base = { ...appointmentTypeVisual } as Record<AppointmentType, AppointmentTypeVisualRow>
  if (!settings?.treatmentTypes?.length) return base
  for (const row of settings.treatmentTypes) {
    const vis = TREATMENT_COLOR_PRESET_VISUAL[row.colorPreset]
    if (vis && base[row.type]) {
      base[row.type] = { ...vis, label: row.label || base[row.type].label }
    }
  }
  return base
}

export function readClinicSettings(): ClinicSettings {
  if (typeof window === "undefined") return createDefaultClinicSettings()
  try {
    const raw = window.localStorage.getItem(CLINIC_SETTINGS_KEY)
    if (!raw) return createDefaultClinicSettings()
    const parsed = JSON.parse(raw) as ClinicSettings
    if (parsed?.version !== 1) return createDefaultClinicSettings()
    return normalizeClinicSettings(parsed)
  } catch {
    return createDefaultClinicSettings()
  }
}

function normalizeClinicSettings(partial: Partial<ClinicSettings>): ClinicSettings {
  const d = createDefaultClinicSettings()
  return {
    version: 1,
    profile: { ...d.profile, ...partial.profile },
    weekdays: partial.weekdays?.length ? partial.weekdays : d.weekdays,
    treatmentTypes: partial.treatmentTypes?.length ? partial.treatmentTypes : d.treatmentTypes,
    defaultPlanSessions: partial.defaultPlanSessions ?? d.defaultPlanSessions,
    carePlans: partial.carePlans?.length ? partial.carePlans : d.carePlans,
    integrations: { ...d.integrations, ...partial.integrations },
    notifications: { ...d.notifications, ...partial.notifications },
  }
}

export function writeClinicSettings(settings: ClinicSettings): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CLINIC_SETTINGS_KEY, JSON.stringify(settings))
    window.dispatchEvent(new Event("clinic-settings-saved"))

    // Keep Financial OS integration strip in sync with Billing provider choice.
    const integrationPayload = {
      provider: settings.integrations.billingProvider,
      connected: settings.integrations.billingConnected,
      lastSyncAt: new Date().toISOString(),
      autoSyncMinutes: 15,
    }
    window.localStorage.setItem("billing.integration.v1", JSON.stringify(integrationPayload))
  } catch {
    /* quota / private mode */
  }
}

export function getTreatmentPriceIls(type: AppointmentType): number | null {
  if (typeof window === "undefined") return null
  const s = readClinicSettings()
  const row = s.treatmentTypes.find((t) => t.type === type)
  if (!row || typeof row.priceIls !== "number") return null
  return row.priceIls
}
