import { DEFAULT_CLINIC_TIMEZONE } from "@/features/automations/lib/clinic-time"
import { defaultSequences } from "@/features/automations/lib/default-sequences"
import type { AvailabilityWindow, ClinicAutomations } from "@/types/automation"
import type { AppointmentType } from "@/types/domain"
import type {
  CarePlan,
  ClinicIntegrations,
  ClinicNotifications,
  ClinicProfile,
  ClinicSettings,
  TreatmentColorPreset,
  TreatmentTypeSetting,
  WeekdayScheduleSlot,
} from "@/types/clinic-settings"

const WEEK_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function defaultWeekdays(): WeekdayScheduleSlot[] {
  return WEEK_LABELS.map((label, weekdayIndex) => ({
    weekdayIndex,
    label,
    open: weekdayIndex < 5,
    openTime: "09:00",
    closeTime: weekdayIndex < 5 ? "18:00" : "13:00",
  }))
}

const TYPE_DEFAULTS: Record<
  AppointmentType,
  { label: string; minutes: number; preset: TreatmentColorPreset; priceIls: number }
> = {
  first: { label: "First Visit", minutes: 45, preset: "violet", priceIls: 350 },
  adjustments: { label: "Adjustments", minutes: 30, preset: "emerald", priceIls: 250 },
  kupa: { label: "Kupa", minutes: 20, preset: "amber", priceIls: 150 },
}

export function defaultTreatmentTypes(): TreatmentTypeSetting[] {
  return (["first", "adjustments", "kupa"] as const).map((type) => ({
    type,
    label: TYPE_DEFAULTS[type].label,
    defaultMinutes: TYPE_DEFAULTS[type].minutes,
    colorPreset: TYPE_DEFAULTS[type].preset,
    priceIls: TYPE_DEFAULTS[type].priceIls,
  }))
}

export function defaultProfile(): ClinicProfile {
  return {
    practitionerName: "",
    phone: "",
    email: "",
    clinicName: "Serene Spine Clinic",
    address: "",
    logoDataUrl: null,
  }
}

export function defaultIntegrations(): ClinicIntegrations {
  return {
    billingProvider: "Morning",
    billingApiKey: "",
    billingConnected: true,
    googleCalendarConnected: false,
    outlookConnected: false,
  }
}

export function defaultNotifications(): ClinicNotifications {
  return {
    whatsappEnabled: true,
    smsEnabled: false,
    emailEnabled: true,
    dailyDigest: true,
    weeklyReport: false,
  }
}

/**
 * Windows a patient may pick when rescheduling themselves. Narrower than the
 * clinic's opening hours by design — the point is to steer self-service traffic
 * into slots the practitioner is happy to give away.
 */
function defaultFutureAvailability(): AvailabilityWindow[] {
  return [
    { id: "av-mon-am", weekdayIndex: 0, startTime: "09:00", endTime: "13:00" },
    { id: "av-tue-pm", weekdayIndex: 1, startTime: "14:00", endTime: "18:00" },
    { id: "av-wed-am", weekdayIndex: 2, startTime: "09:00", endTime: "13:00" },
    { id: "av-thu-pm", weekdayIndex: 3, startTime: "14:00", endTime: "18:00" },
  ]
}

export function defaultAutomations(): ClinicAutomations {
  return {
    timezone: DEFAULT_CLINIC_TIMEZONE,
    sequences: defaultSequences(),
    futureAvailability: defaultFutureAvailability(),
    // Nothing automated reaches a patient overnight.
    quietHours: { enabled: true, start: "21:00", end: "08:00" },
    noShowGraceMinutes: 20,
    progressQuestionnaireEverySessions: 6,
    selfBooking: {
      enabled: true,
      requireDocuments: false,
      allowedTypes: ["first", "adjustments", "kupa"],
      leadTimeHours: 12,
      horizonDays: 30,
    },
  }
}

export function defaultCarePlans(): CarePlan[] {
  return [
    { id: "cp-1", name: "Wellness 10-pack", sessions: 10, totalPriceIls: 2100 },
    { id: "cp-2", name: "Intensive 6-pack", sessions: 6, totalPriceIls: 1400 },
  ]
}

export function createDefaultClinicSettings(): ClinicSettings {
  return {
    version: 1,
    profile: defaultProfile(),
    weekdays: defaultWeekdays(),
    treatmentTypes: defaultTreatmentTypes(),
    defaultPlanSessions: 10,
    carePlans: defaultCarePlans(),
    integrations: defaultIntegrations(),
    notifications: defaultNotifications(),
    automations: defaultAutomations(),
  }
}
