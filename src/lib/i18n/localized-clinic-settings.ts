import type { AppointmentType } from "@/types/domain"
import type { ClinicSettings } from "@/types/clinic-settings"
import { createDefaultClinicSettings } from "@/lib/clinic-settings-defaults"
import type { Locale } from "@/lib/i18n/types"

const EN = createDefaultClinicSettings()

const HE_TYPE_LABEL: Record<AppointmentType, string> = {
  first: "ביקור ראשון",
  adjustments: "טיפולי התאמה",
  kupa: "קופה",
}

const AR_TYPE_LABEL: Record<AppointmentType, string> = {
  first: "زيارة أولى",
  adjustments: "جلسات مواءمة",
  kupa: "صندوق",
}

const HE_PLAN_NAME: Record<string, string> = {
  "cp-1": "חבילת וולנס 10 טיפולים",
  "cp-2": "חבילה אינטנסיבית 6 טיפולים",
}

const AR_PLAN_NAME: Record<string, string> = {
  "cp-1": "باقة العافية — 10 جلسات",
  "cp-2": "باقة مكثّفة — 6 جلسات",
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

const AR_WEEKDAY: string[] = [
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
  "الأحد",
]

const HE_CLINIC_NAME = "מרפאת עמוד שדרה שקטה"
const AR_CLINIC_NAME = "عيادة العمود الفقري الهادئة"

const HE_NOTIF_TEMPLATE =
  "שלום {patient_name}, תזכורת: תור ב־{clinic_name} בתאריך {date} בשעה {time}. נשמח לעדכון במידת הצורך."

const AR_NOTIF_TEMPLATE =
  "مرحباً {patient_name}، تذكير: موعد في {clinic_name} بتاريخ {date} الساعة {time}. يُرجى إبلاغنا عند الحاجة."

function cloneSettings(s: ClinicSettings): ClinicSettings {
  return JSON.parse(JSON.stringify(s)) as ClinicSettings
}

function applyOverlay(
  s: ClinicSettings,
  typeLabel: Record<AppointmentType, string>,
  planName: Record<string, string>,
  weekday: string[],
  clinicName: string,
  notifTemplate: string,
): ClinicSettings {
  const next = cloneSettings(s)
  next.treatmentTypes = next.treatmentTypes.map((row) => {
    const def = EN.treatmentTypes.find((d) => d.type === row.type)
    if (def && row.label === def.label) {
      return { ...row, label: typeLabel[row.type] }
    }
    return row
  })
  next.carePlans = next.carePlans.map((p) => {
    const def = EN.carePlans.find((d) => d.id === p.id)
    const localized = planName[p.id]
    if (def && localized && p.name === def.name) {
      return { ...p, name: localized }
    }
    return p
  })
  next.weekdays = next.weekdays.map((wd, i) => {
    const def = EN.weekdays[i]
    if (def && wd.label === def.label && weekday[i]) {
      return { ...wd, label: weekday[i] }
    }
    return wd
  })
  if (next.notifications.messageTemplate === EN.notifications.messageTemplate) {
    next.notifications.messageTemplate = notifTemplate
  }
  if (next.profile.clinicName === EN.profile.clinicName) {
    next.profile.clinicName = clinicName
  }
  return next
}

function invertOverlay(
  s: ClinicSettings,
  typeLabel: Record<AppointmentType, string>,
  planName: Record<string, string>,
  weekday: string[],
  clinicName: string,
  notifTemplate: string,
): ClinicSettings {
  const next = cloneSettings(s)
  next.treatmentTypes = next.treatmentTypes.map((row) => {
    if (row.label === typeLabel[row.type]) {
      const def = EN.treatmentTypes.find((d) => d.type === row.type)
      if (def) return { ...row, label: def.label }
    }
    return row
  })
  next.carePlans = next.carePlans.map((p) => {
    const localized = planName[p.id]
    const def = EN.carePlans.find((d) => d.id === p.id)
    if (localized && p.name === localized && def) {
      return { ...p, name: def.name }
    }
    return p
  })
  next.weekdays = next.weekdays.map((wd, i) => {
    if (weekday[i] && wd.label === weekday[i]) {
      const def = EN.weekdays[i]
      if (def) return { ...wd, label: def.label }
    }
    return wd
  })
  if (next.notifications.messageTemplate === notifTemplate) {
    next.notifications.messageTemplate = EN.notifications.messageTemplate
  }
  if (next.profile.clinicName === clinicName) {
    next.profile.clinicName = EN.profile.clinicName
  }
  return next
}

export function applyHebrewClinicOverlay(s: ClinicSettings): ClinicSettings {
  return applyOverlay(s, HE_TYPE_LABEL, HE_PLAN_NAME, HE_WEEKDAY, HE_CLINIC_NAME, HE_NOTIF_TEMPLATE)
}

export function invertHebrewClinicOverlay(s: ClinicSettings): ClinicSettings {
  return invertOverlay(s, HE_TYPE_LABEL, HE_PLAN_NAME, HE_WEEKDAY, HE_CLINIC_NAME, HE_NOTIF_TEMPLATE)
}

export function applyArabicClinicOverlay(s: ClinicSettings): ClinicSettings {
  return applyOverlay(s, AR_TYPE_LABEL, AR_PLAN_NAME, AR_WEEKDAY, AR_CLINIC_NAME, AR_NOTIF_TEMPLATE)
}

export function invertArabicClinicOverlay(s: ClinicSettings): ClinicSettings {
  return invertOverlay(s, AR_TYPE_LABEL, AR_PLAN_NAME, AR_WEEKDAY, AR_CLINIC_NAME, AR_NOTIF_TEMPLATE)
}

/** Display overlay for active locale; English returns canonical stored values. */
export function applyLocaleClinicOverlay(s: ClinicSettings, locale: Locale): ClinicSettings {
  if (locale === "he") return applyHebrewClinicOverlay(s)
  if (locale === "ar") return applyArabicClinicOverlay(s)
  return s
}

/** Persist English defaults when on-screen text still matches locale overlay. */
export function invertLocaleClinicOverlay(s: ClinicSettings, locale: Locale): ClinicSettings {
  if (locale === "he") return invertHebrewClinicOverlay(s)
  if (locale === "ar") return invertArabicClinicOverlay(s)
  return s
}
