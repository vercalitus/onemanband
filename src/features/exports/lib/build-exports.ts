import {
  listOutbox,
  listQuestionnaires,
  listResponses,
} from "@/features/automations/lib/automation-store"
import { readOptOut } from "@/features/patients/lib/patient-extras-store"
import type { ExportSource } from "@/features/exports/lib/export-source"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { CsvColumn } from "@/lib/file-export"
import type {
  BillingInvoice,
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
 * Nothing here reads a data source. Every builder is handed an `ExportSource`,
 * which is what makes a backup a backup: these functions used to import the
 * demo file directly, so the whole-clinic export produced eight invented
 * patients while the clinic held 1,178 real ones — and the file said nothing
 * about it. Resolving the data outside this layer means there is exactly one
 * place that decides where an export comes from.
 */

export interface ExportOptions {
  /** Include free-text medical history, treatment notes and questionnaires. */
  includeClinical: boolean
}

/* -------------------------------------------------------------------------- */
/* Patients                                                                    */
/* -------------------------------------------------------------------------- */

export function patientColumns(
  options: ExportOptions,
  source?: ExportSource,
): CsvColumn<PatientSummary>[] {
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
    { header: "Treatment records", value: (p) => source?.treatmentsFor(p.id).length ?? 0 },
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

export function allTreatmentRows(
  source: ExportSource,
): (TreatmentRecord & { patientId: string })[] {
  return source.patients.flatMap((p) =>
    source.treatmentsFor(p.id).map((r) => ({ ...r, patientId: p.id })),
  )
}

export const exportDatasets = {
  patients: (source: ExportSource) => source.patients,
  appointments: (source: ExportSource) => source.appointments,
  invoices: (source: ExportSource) => source.invoices,
  treatments: (source: ExportSource) => allTreatmentRows(source),
}

/* -------------------------------------------------------------------------- */
/* Bundles                                                                     */
/* -------------------------------------------------------------------------- */

/** Everything held about one patient. */
export function buildPatientBundle(
  patientId: string,
  options: ExportOptions,
  source: ExportSource,
) {
  const patient = source.patients.find((p) => p.id === patientId)
  if (!patient) return null

  const { medicalHistorySummary, generalNotes, ...contact } = patient

  return {
    exportedAt: new Date().toISOString(),
    includesClinical: options.includeClinical,
    patient: options.includeClinical
      ? { ...contact, medicalHistorySummary, generalNotes }
      : contact,
    notificationPreferences: readOptOut(patientId),
    appointments: source.appointments.filter((a) => a.patientId === patientId),
    invoices: source.invoices.filter((i) => i.patientId === patientId),
    finances: source.financesFor(patientId),
    documents: source.documentsFor(patientId),
    ...(options.includeClinical
      ? {
          treatments: source.treatmentsFor(patientId),
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
export function buildFullBackup(options: ExportOptions, source: ExportSource) {
  return {
    exportedAt: new Date().toISOString(),
    // Stated in the file itself. A backup taken from the demo dataset is not a
    // backup, and the one thing worse than not having one is believing you do.
    source: source.live ? "clinic database" : "demonstration data",
    includesClinical: options.includeClinical,
    clinicSettings: readClinicSettings(),
    patients: source.patients.map((p) => {
      const { medicalHistorySummary, generalNotes, ...contact } = p
      return {
        ...(options.includeClinical ? { ...contact, medicalHistorySummary, generalNotes } : contact),
        notificationPreferences: readOptOut(p.id),
        finances: source.financesFor(p.id),
        documents: source.documentsFor(p.id),
        ...(options.includeClinical ? { treatments: source.treatmentsFor(p.id) } : {}),
      }
    }),
    appointments: source.appointments,
    invoices: source.invoices,
    automations: {
      outbox: listOutbox(),
      patientResponses: listResponses(),
      ...(options.includeClinical ? { questionnaires: listQuestionnaires() } : {}),
    },
  }
}
