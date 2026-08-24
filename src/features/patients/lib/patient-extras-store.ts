import type { FinanceRecord, TreatmentRecord } from "@/types/domain"
import type { MessageChannel } from "@/types/automation"

/**
 * Per-patient overlay storage.
 *
 * The mock dataset in `mock-data.ts` is read-only seed content; anything the
 * app or an automation adds to a patient lives here, keyed
 * `patient.<id>.<field>`. `usePatientCockpit` has used this shape since before
 * automations existed — it is extracted into its own module so the automation
 * engine can file records into a patient without importing the cockpit hook.
 *
 * Browser-only, like every other mock-mode store. Reads fall back silently.
 */

const storageKey = (patientId: string, field: string) => `patient.${patientId}.${field}`

/** Fired after any overlay write so open views can re-read. */
export const PATIENT_EXTRAS_EVENT = "patient-extras-changed"

export function readField<T>(patientId: string, field: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(storageKey(patientId, field))
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeField(patientId: string, field: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(patientId, field), JSON.stringify(value))
    window.dispatchEvent(new Event(PATIENT_EXTRAS_EVENT))
  } catch {
    /* quota / private mode */
  }
}

/* -------------------------------------------------------------------------- */
/* Timeline entries added by automations (questionnaires, filed results)       */
/* -------------------------------------------------------------------------- */

const ADDED_TREATMENTS = "addedTreatments"

export function readAddedTreatments(patientId: string): TreatmentRecord[] {
  return readField<TreatmentRecord[]>(patientId, ADDED_TREATMENTS, [])
}

/** Append a timeline entry, ignoring a repeat of one already filed. */
export function addTreatmentRecord(patientId: string, record: TreatmentRecord): boolean {
  const existing = readAddedTreatments(patientId)
  if (existing.some((r) => r.id === record.id)) return false
  writeField(patientId, ADDED_TREATMENTS, [record, ...existing])
  return true
}

/* -------------------------------------------------------------------------- */
/* Finance rows added by automations (auto-issued invoices)                    */
/* -------------------------------------------------------------------------- */

const ADDED_FINANCES = "addedFinances"

export function readAddedFinances(patientId: string): FinanceRecord[] {
  return readField<FinanceRecord[]>(patientId, ADDED_FINANCES, [])
}

export function addFinanceRecord(patientId: string, record: FinanceRecord): boolean {
  const existing = readAddedFinances(patientId)
  if (existing.some((r) => r.id === record.id)) return false
  writeField(patientId, ADDED_FINANCES, [record, ...existing])
  return true
}

/* -------------------------------------------------------------------------- */
/* Notification opt-out                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A patient's own wishes about being messaged.
 *
 * Checked in the planner before any channel is used, so an opt-out silences
 * every sequence at once rather than requiring each to be edited. `all` is
 * kept separate from the per-channel flags because "stop contacting me" and
 * "email me but don't WhatsApp me" are different requests and the stronger one
 * must not be lost when the weaker one is edited.
 */
export interface NotificationOptOut {
  all: boolean
  whatsapp: boolean
  email: boolean
  sms: boolean
  /** Free-text reason, shown to the practitioner only. */
  note?: string
}

const OPT_OUT = "notificationOptOut"

export const emptyOptOut = (): NotificationOptOut => ({
  all: false,
  whatsapp: false,
  email: false,
  sms: false,
})

export function readOptOut(patientId: string): NotificationOptOut {
  return { ...emptyOptOut(), ...readField(patientId, OPT_OUT, emptyOptOut()) }
}

export function writeOptOut(patientId: string, value: NotificationOptOut): void {
  writeField(patientId, OPT_OUT, value)
}

/** True when this patient still accepts messages on the given channel. */
export function allowsChannel(patientId: string, channel: MessageChannel): boolean {
  const optOut = readOptOut(patientId)
  return !optOut.all && !optOut[channel]
}
