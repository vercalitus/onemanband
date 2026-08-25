import type { ClinicAutomations } from "@/types/automation"
import type { AppointmentType, InvoiceProvider } from "@/types/domain"

/** Visual preset for calendar / chips — maps to Tailwind class bundles. */
export type TreatmentColorPreset = "violet" | "emerald" | "amber" | "sky" | "rose"

export interface WeekdayScheduleSlot {
  /** 0 = Monday … 6 = Sunday */
  weekdayIndex: number
  label: string
  open: boolean
  openTime: string
  closeTime: string
}

export interface TreatmentTypeSetting {
  type: AppointmentType
  /** Editable label shown in scheduler and settings */
  label: string
  defaultMinutes: number
  colorPreset: TreatmentColorPreset
  /** Price in ILS — feeds Finances when generating invoices */
  priceIls: number
}

export interface CarePlan {
  id: string
  name: string
  sessions: number
  totalPriceIls: number
}

export interface ClinicProfile {
  practitionerName: string
  phone: string
  email: string
  clinicName: string
  address: string
  logoDataUrl: string | null
}

export interface ClinicIntegrations {
  billingProvider: InvoiceProvider
  /**
   * Result of the last connection check — not a setting the user types.
   *
   * There is deliberately no API key here. The bookkeeping key can issue tax
   * documents, so it lives in the server environment and is never held in
   * `localStorage`, where every script on the page can read it.
   */
  billingConnected: boolean
  googleCalendarConnected: boolean
  outlookConnected: boolean
}

/**
 * Channel master switches and practice-facing digests.
 *
 * A channel switched off here is off for every sequence, whatever the
 * individual steps say. Per-message timing and copy are not here — they belong
 * to the steps in `ClinicSettings.automations`, which is the only place that
 * can express a ladder of several reminders.
 */
export interface ClinicNotifications {
  whatsappEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  dailyDigest: boolean
  weeklyReport: boolean
}

export interface ClinicSettings {
  version: 1
  profile: ClinicProfile
  weekdays: WeekdayScheduleSlot[]
  treatmentTypes: TreatmentTypeSetting[]
  defaultPlanSessions: number
  carePlans: CarePlan[]
  integrations: ClinicIntegrations
  notifications: ClinicNotifications
  automations: ClinicAutomations
}
