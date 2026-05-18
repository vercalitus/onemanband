import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import type { AppointmentType } from "@/types/domain"
import type { ClinicSettings } from "@/types/clinic-settings"

const EN = createDefaultClinicSettings()

const HE_TYPE_LABEL: Record<AppointmentType, string> = {
  first: "ביקור ראשון",
  adjustments: "טיפולי התאמה",
  kupa: "קופה",
}

const HE_PLAN_NAME: Record<string, string> = {
  "cp-1": "חבילת וולנס 10 טיפולים",
  "cp-2": "חבילה אינטנסיבית 6 טיפולים",
}

const HE_WEEKDAY: string[] = [
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "יום שבת",
  "יום ראשון",
]

const HE_CLINIC_NAME = "מרפאת עמוד שדרה שקטה"

const HE_NOTIF_TEMPLATE =
  "שלום {patient_name}, תזכורת: תור ב־{clinic_name} בתאריך {date} בשעה {time}. נשמח לעדכון במידת הצורך."

function cloneSettings(s: ClinicSettings): ClinicSettings {
  return JSON.parse(JSON.stringify(s)) as ClinicSettings
}

/**
 * When the UI is in Hebrew, replace known English *default* demo strings with
 * Hebrew so the settings screen matches the rest of the locale — without
 * touching values the user already customized.
 */
export function applyHebrewClinicOverlay(s: ClinicSettings): ClinicSettings {
  const next = cloneSettings(s)
  next.treatmentTypes = next.treatmentTypes.map((row) => {
    const def = EN.treatmentTypes.find((d) => d.type === row.type)
    if (def && row.label === def.label) {
      return { ...row, label: HE_TYPE_LABEL[row.type] }
    }
    return row
  })
  next.carePlans = next.carePlans.map((p) => {
    const def = EN.carePlans.find((d) => d.id === p.id)
    const he = HE_PLAN_NAME[p.id]
    if (def && he && p.name === def.name) {
      return { ...p, name: he }
    }
    return p
  })
  next.weekdays = next.weekdays.map((wd, i) => {
    const def = EN.weekdays[i]
    if (def && wd.label === def.label && HE_WEEKDAY[i]) {
      return { ...wd, label: HE_WEEKDAY[i] }
    }
    return wd
  })
  if (next.notifications.messageTemplate === EN.notifications.messageTemplate) {
    next.notifications.messageTemplate = HE_NOTIF_TEMPLATE
  }
  if (next.profile.clinicName === EN.profile.clinicName) {
    next.profile.clinicName = HE_CLINIC_NAME
  }
  return next
}

/**
 * Persist English canonical defaults when the on-screen value still matches
 * our Hebrew overlay, so switching back to English does not leak Hebrew into
 * stored settings.
 */
export function invertHebrewClinicOverlay(s: ClinicSettings): ClinicSettings {
  const next = cloneSettings(s)
  next.treatmentTypes = next.treatmentTypes.map((row) => {
    if (row.label === HE_TYPE_LABEL[row.type]) {
      const def = EN.treatmentTypes.find((d) => d.type === row.type)
      if (def) return { ...row, label: def.label }
    }
    return row
  })
  next.carePlans = next.carePlans.map((p) => {
    const he = HE_PLAN_NAME[p.id]
    const def = EN.carePlans.find((d) => d.id === p.id)
    if (he && p.name === he && def) {
      return { ...p, name: def.name }
    }
    return p
  })
  next.weekdays = next.weekdays.map((wd, i) => {
    if (HE_WEEKDAY[i] && wd.label === HE_WEEKDAY[i]) {
      const def = EN.weekdays[i]
      if (def) return { ...wd, label: def.label }
    }
    return wd
  })
  if (next.notifications.messageTemplate === HE_NOTIF_TEMPLATE) {
    next.notifications.messageTemplate = EN.notifications.messageTemplate
  }
  if (next.profile.clinicName === HE_CLINIC_NAME) {
    next.profile.clinicName = EN.profile.clinicName
  }
  return next
}
