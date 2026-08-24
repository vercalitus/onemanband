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
  billingApiKey: string
  billingConnected: boolean
  googleCalendarConnected: boolean
  outlookConnected: boolean
}

/**
 * Channel master switches and practice-facing digests.
 *
 * `hoursBefore` / `messageTemplate` predate the automation engine and now act
 * as the simple single-reminder fallback for clinics that never open the
 * Automations tab. The per-step ladder in `ClinicSettings.automations`
 * supersedes them when its sequence is enabled.
 */
export interface ClinicNotifications {
  whatsappEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  hoursBefore: number
  messageTemplate: string
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
