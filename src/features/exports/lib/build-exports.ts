import {
  listOutbox,
  listQuestionnaires,
  listResponses,
} from "@/features/automations/lib/automation-store"
import {
  readAddedFinances,
  readAddedTreatments,
  readOptOut,
} from "@/features/patients/lib/patient-extras-store"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { CsvColumn } from "@/lib/file-export"
import {
  documentsByPatient,
  financesByPatient,
  patients,
  todaySchedule,
  treatmentsByPatient,
  weeklySchedule,
} from "@/lib/mock-data"
import { seedInvoices } from "@/lib/mock-finances"
import type {
  BillingInvoice,
  DocumentRecord,
  FinanceRecord,
  PatientSummary,
  ScheduleItem,
  TreatmentRecord,
} from "@/types/domain"

/**
 * Dataset builders for export.
 *
 * The one rule that shapes this file: **clinical content is opt-in**. A
 * clinic exports a patient list with emails far more often than it exports
 * medical records, and the two carry very different risk once the file is
 * sitting in someone's Downloads folder. So every builder takes
 * `includeClinical` and the caller has to ask for it.
 *
 * Reads the mock dataset plus the localStorage overlays that the app actually
 * writes to. When Supabase goes live these become queries and nothing above
 * this layer changes.
 */

export interface ExportOptions {
  /** Include free-text medical history, treatment notes and questionnaires. */
  includeClinical: boolean
}

const allAppointments = (): ScheduleItem[] => [...todaySchedule, ...weeklySchedule]

/** Mock seed plus anything the app has written since. */
function invoicesForExport(): BillingInvoice[] {
  if (typeof window === "undefined") return seedInvoices
  try {
    const raw = window.localStorage.getItem("billing.invoices.v1")
    const stored = raw ? (JSON.parse(raw) as BillingInvoice[]) : []
    const byId = new Map(seedInvoices.map((i) => [i.id, i]))
    for (const invoice of stored) byId.set(invoice.id, invoice)
    return [...byId.values()]
  } catch {
    return seedInvoices
  }
}

const treatmentsFor = (patientId: string): TreatmentRecord[] => [
  ...readAddedTreatments(patientId),
  ...(treatmentsByPatient[patientId] ?? []),
]

const financesFor = (patientId: string): FinanceRecord[] => [
  ...readAddedFinances(patientId),
  ...(financesByPatient[patientId] ?? []),
]

const documentsFor = (patientId: string): DocumentRecord[] => documentsByPatient[patientId] ?? []

/* -------------------------------------------------------------------------- */
/* Patients                                                                    */
/* -------------------------------------------------------------------------- */

export function patientColumns(options: ExportOptions): CsvColumn<PatientSummary>[] {
  const base: CsvColumn<PatientSummary>[] = [
    { header: "Patient ID", value: (p) => p.id },
    { header: "Full name", value: (p) => p.fullName },
    { header: "Phone", value: (p) => p.phone },
    { header: "Email", value: (p) => p.email },
    { header: "Address", value: (p) => p.address ?? "" },
    { header: "Status", value: (p) => p.status },
    { header: "Last visit", value: (p) => p.lastVisit },
    { header: "Balance", value: (p) => p.balance },
    { header: "Tags", value: (p) => p.tags.join("; ") },
    // Not clinical: this is a contact preference the clinic must honour, and
    // it has to survive a migration to another system.
    { header: "Messages opted out", value: (p) => (readOptOut(p.id).all ? "yes" : "no") },
  ]

  if (!options.includeClinical) return base

  return [
    ...base,
    { header: "Medical history", value: (p) => p.medicalHistorySummary },
    { header: "General notes", value: (p) => p.generalNotes },
    { header: "Treatment records", value: (p) => treatmentsFor(p.id).length },
  ]
}

/* -------------------------------------------------------------------------- */
/* Appointments / invoices / treatments                                        */
/* -------------------------------------------------------------------------- */

export const appointmentColumns: CsvColumn<ScheduleItem>[] = [
  { header: "Appointment ID", value: (a) => a.id },
  { header: "Patient ID", value: (a) => a.patientId },
  { header: "Patient", value: (a) => a.patientName },
  { header: "Date", value: (a) => a.date },
  { header: "Start", value: (a) => a.start },
  { header: "End", value: (a) => a.end },
  { header: "Type", value: (a) => a.appointmentType },
  { header: "Status", value: (a) => a.status },
  { header: "Treatment", value: (a) => a.treatment },
]

export const invoiceColumns: CsvColumn<BillingInvoice>[] = [
  { header: "Invoice ID", value: (i) => i.id },
  { header: "Patient ID", value: (i) => i.patientId },
  { header: "Patient", value: (i) => i.patientName },
  { header: "Amount", value: (i) => i.amount },
  { header: "Currency", value: () => "ILS" },
  { header: "Invoice status", value: (i) => i.status },
  { header: "Payment status", value: (i) => i.paymentStatus },
  { header: "Treatment", value: (i) => i.treatmentType },
  { header: "Issued", value: (i) => i.issuedAt ?? "" },
  { header: "Due", value: (i) => i.dueAt ?? "" },
  { header: "Paid", value: (i) => i.paidAt ?? "" },
  { header: "Provider", value: (i) => i.provider },
  { header: "Sync", value: (i) => i.syncStatus },
]

/** Clinical by definition — only ever built when the caller opted in. */
export const treatmentColumns: CsvColumn<TreatmentRecord & { patientId: string }>[] = [
  { header: "Record ID", value: (r) => r.id },
  { header: "Patient ID", value: (r) => r.patientId },
  { header: "Recorded at", value: (r) => r.recordedAt },
  { header: "Practitioner", value: (r) => r.practitioner },
  { header: "Title", value: (r) => r.title },
  { header: "Note", value: (r) => r.note },
]

export function allTreatmentRows(): (TreatmentRecord & { patientId: string })[] {
  return patients.flatMap((p) => treatmentsFor(p.id).map((r) => ({ ...r, patientId: p.id })))
}

export const exportDatasets = {
  patients: () => patients,
  appointments: allAppointments,
  invoices: invoicesForExport,
  treatments: allTreatmentRows,
}

/* -------------------------------------------------------------------------- */
/* Bundles                                                                     */
/* -------------------------------------------------------------------------- */

/** Everything held about one patient. */
export function buildPatientBundle(patientId: string, options: ExportOptions) {
  const patient = patients.find((p) => p.id === patientId)
  if (!patient) return null

  const { medicalHistorySummary, generalNotes, ...contact } = patient

  return {
    exportedAt: new Date().toISOString(),
    includesClinical: options.includeClinical,
    patient: options.includeClinical
      ? { ...contact, medicalHistorySummary, generalNotes }
      : contact,
    notificationPreferences: readOptOut(patientId),
    appointments: allAppointments().filter((a) => a.patientId === patientId),
    invoices: invoicesForExport().filter((i) => i.patientId === patientId),
    finances: financesFor(patientId),
    documents: documentsFor(patientId),
    ...(options.includeClinical
      ? {
          treatments: treatmentsFor(patientId),
          questionnaires: listQuestionnaires().filter((q) => q.patientId === patientId),
        }
      : {}),
  }
}

/**
 * Complete clinic backup.
 *
 * JSON rather than CSV because this is for moving to another system or keeping
 * a true copy — it has to be exact and complete, and a folder of flat files
 * loses the relationships between them.
 */
export function buildFullBackup(options: ExportOptions) {
  return {
    exportedAt: new Date().toISOString(),
    includesClinical: options.includeClinical,
    clinicSettings: readClinicSettings(),
    patients: patients.map((p) => {
      const { medicalHistorySummary, generalNotes, ...contact } = p
      return {
        ...(options.includeClinical ? { ...contact, medicalHistorySummary, generalNotes } : contact),
        notificationPreferences: readOptOut(p.id),
        finances: financesFor(p.id),
        documents: documentsFor(p.id),
        ...(options.includeClinical ? { treatments: treatmentsFor(p.id) } : {}),
      }
    }),
    appointments: allAppointments(),
    invoices: invoicesForExport(),
    automations: {
      outbox: listOutbox(),
      patientResponses: listResponses(),
      ...(options.includeClinical ? { questionnaires: listQuestionnaires() } : {}),
    },
  }
}
