import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import { appointmentTypeVisual } from "@/lib/appointment-types"
import type { ClinicAutomations } from "@/types/automation"
import type { AppointmentType } from "@/types/domain"
import type {
  ClinicIntegrations,
  ClinicSettings,
  TreatmentColorPreset,
} from "@/types/clinic-settings"

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

/**
 * Merge stored automation sequences over the defaults.
 *
 * Saved settings are the user's edits and always win, but a sequence or step
 * added to the default playbook in a later release must still show up for
 * clinics that saved before it existed — otherwise upgrading silently drops
 * new automation behaviour. Matching is by id; unknown stored ids are kept.
 */
/**
 * Steps withdrawn from the playbook. A saved copy is dropped rather than
 * carried forward as a custom extra, which is what the merge below would
 * otherwise do with any step it no longer recognises.
 *
 * `step-post-invoice` sent the patient their invoice an hour after the
 * session. The bookkeeping provider emails the document itself when it issues
 * it, so this was a second copy of the same thing.
 */
const RETIRED_STEP_IDS = new Set(["step-post-invoice"])

/**
 * Steps whose *meaning* changed, not just their wording. The stored copy is
 * discarded in favour of the current default, because merging would preserve
 * exactly the part that is now wrong.
 *
 * `step-unpaid-daily` used to attach the invoice to a payment reminder. An
 * invoice-receipt cannot exist before the payment does, so the step now asks
 * the patient whether they have already paid. A saved copy would keep the
 * `open_invoice` action and go on offering a document that must not be there.
 */
const RESET_STEP_IDS = new Set(["step-unpaid-daily"])

function mergeAutomations(
  stored: Partial<ClinicAutomations> | undefined,
  d: ClinicAutomations,
): ClinicAutomations {
  if (!stored) return d
  const storedSequences = stored.sequences ?? []
  const byId = new Map(storedSequences.map((s) => [s.id, s]))

  const sequences = d.sequences.map((defSeq) => {
    const own = byId.get(defSeq.id)
    if (!own) return defSeq
    byId.delete(defSeq.id)
    const ownSteps = new Map(
      (own.steps ?? [])
        .filter((s) => !RETIRED_STEP_IDS.has(s.id))
        .map((s) => [s.id, s]),
    )
    const steps = defSeq.steps.map((defStep) => {
      const ownStep = ownSteps.get(defStep.id)
      if (!ownStep) return defStep
      ownSteps.delete(defStep.id)
      if (RESET_STEP_IDS.has(defStep.id)) return defStep
      return { ...defStep, ...ownStep, template: { ...defStep.template, ...ownStep.template } }
    })
    return { ...defSeq, ...own, steps: [...steps, ...ownSteps.values()] }
  })

  return {
    timezone: stored.timezone || d.timezone,
    sequences: [...sequences, ...byId.values()],
    futureAvailability: stored.futureAvailability?.length
      ? stored.futureAvailability
      : d.futureAvailability,
    quietHours: { ...d.quietHours, ...stored.quietHours },
    noShowGraceMinutes: stored.noShowGraceMinutes ?? d.noShowGraceMinutes,
    progressQuestionnaireEverySessions:
      stored.progressQuestionnaireEverySessions ?? d.progressQuestionnaireEverySessions,
    selfBooking: { ...d.selfBooking, ...stored.selfBooking },
  }
}

/**
 * Pick known integration fields explicitly rather than spreading.
 *
 * Earlier builds stored a billing API key in this object. Spreading would
 * carry that key forward forever; listing the fields drops it on the next save
 * — which is the migration. It also stops any future stray field from
 * surviving in `localStorage` unnoticed.
 */
function normalizeIntegrations(
  stored: Partial<ClinicIntegrations> | undefined,
  d: ClinicIntegrations,
): ClinicIntegrations {
  if (!stored) return d
  return {
    billingProvider: stored.billingProvider ?? d.billingProvider,
    billingConnected: stored.billingConnected ?? d.billingConnected,
    googleCalendarConnected: stored.googleCalendarConnected ?? d.googleCalendarConnected,
    outlookConnected: stored.outlookConnected ?? d.outlookConnected,
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
    integrations: normalizeIntegrations(partial.integrations, d.integrations),
    notifications: { ...d.notifications, ...partial.notifications },
    automations: mergeAutomations(partial.automations, d.automations),
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
