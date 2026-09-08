"use client"

import { fetchAppointments } from "@/features/calendar/lib/appointment-repository"
import { fetchInvoices } from "@/features/finances/lib/finance-repository"
import {
  fetchAllDocuments,
  fetchPatientDocuments,
} from "@/features/patients/lib/document-repository"
import { fetchPatients } from "@/features/patients/lib/patient-repository"
import {
  fetchAllTreatments,
  fetchPatientTreatments,
} from "@/features/patients/lib/treatment-repository"
import { readAddedFinances, readAddedTreatments } from "@/features/patients/lib/patient-extras-store"
import { seedInvoices } from "@/lib/mock-finances"
import {
  documentsByPatient,
  financesByPatient,
  patients as mockPatients,
  todaySchedule,
  treatmentsByPatient,
  weeklySchedule,
} from "@/lib/mock-data"
import type {
  BillingInvoice,
  DocumentRecord,
  FinanceRecord,
  PatientSummary,
  ScheduleItem,
  TreatmentRecord,
} from "@/types/domain"

/**
 * What an export is built from.
 *
 * The builders used to read the mock file directly, which made the backup
 * button a lie: it produced a JSON of eight invented patients while the clinic
 * held 1,178 real ones, and nothing about the file said so. Somebody would
 * discover that the day they needed the backup.
 *
 * So the data is resolved first and passed in. Live where there is a database
 * with patients in it, the demo dataset otherwise — the same rule the rest of
 * the app uses, decided by the data rather than by a flag. `live` travels with
 * it so the file can say which one it is.
 */
export interface ExportSource {
  /** True when this came from the clinic's database rather than the demo seed. */
  live: boolean
  patients: PatientSummary[]
  appointments: ScheduleItem[]
  invoices: BillingInvoice[]
  treatmentsFor: (patientId: string) => TreatmentRecord[]
  documentsFor: (patientId: string) => DocumentRecord[]
  financesFor: (patientId: string) => FinanceRecord[]
}

/**
 * A backup is not a view: it covers everything ever booked, not the window the
 * calendar happens to show. Ten years each way is past the age of the clinic
 * and comfortably past anything anyone would book ahead.
 */
const BACKUP_WINDOW_DAYS = 3650

/** Mock seed plus anything the demo app has written to the browser since. */
function mockInvoices(): BillingInvoice[] {
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

function demoSource(): ExportSource {
  return {
    live: false,
    patients: mockPatients,
    appointments: [...todaySchedule, ...weeklySchedule],
    invoices: mockInvoices(),
    treatmentsFor: (id) => [...readAddedTreatments(id), ...(treatmentsByPatient[id] ?? [])],
    documentsFor: (id) => documentsByPatient[id] ?? [],
    financesFor: (id) => [...readAddedFinances(id), ...(financesByPatient[id] ?? [])],
  }
}

/**
 * Everything the clinic holds, for a whole-clinic export.
 *
 * Treatments and documents are fetched in one query each and grouped, rather
 * than per patient: a backup of 1,178 patients would otherwise be 2,356 round
 * trips.
 */
export async function loadExportSource(
  formatMoney: (n: number) => string,
): Promise<ExportSource> {
  const [patientFetch, appointmentFetch, invoiceFetch, treatments, documents] = await Promise.all([
    fetchPatients(),
    fetchAppointments({ fromDaysBack: BACKUP_WINDOW_DAYS, toDaysAhead: BACKUP_WINDOW_DAYS }),
    fetchInvoices(formatMoney),
    fetchAllTreatments(),
    fetchAllDocuments(),
  ])

  // No patients means no clinic yet, and the demo is what there is to export.
  if (patientFetch.source !== "live" || !patientFetch.patients.length) return demoSource()

  return {
    live: true,
    patients: patientFetch.patients,
    appointments: appointmentFetch.source === "live" ? appointmentFetch.appointments : [],
    invoices: invoiceFetch.source === "live" ? invoiceFetch.invoices : [],
    treatmentsFor: (id) => treatments?.get(id) ?? [],
    documentsFor: (id) => documents?.get(id) ?? [],
    // Invoices are the record of money in a live clinic; this overlay only ever
    // held rows the demo wrote to the browser.
    financesFor: () => [],
  }
}

/**
 * The same, for one patient. Narrower queries because a single chart does not
 * need the clinic's whole history to describe itself.
 */
export async function loadPatientExportSource(
  patient: PatientSummary,
  formatMoney: (n: number) => string,
): Promise<ExportSource> {
  const [treatments, documents, invoiceFetch, appointmentFetch] = await Promise.all([
    fetchPatientTreatments(patient.id),
    fetchPatientDocuments(patient.id),
    fetchInvoices(formatMoney),
    fetchAppointments({ fromDaysBack: BACKUP_WINDOW_DAYS, toDaysAhead: BACKUP_WINDOW_DAYS }),
  ])

  // A record read from the database is the live one even when it is empty; the
  // demo fallback is only for a deploy that has no database at all.
  if (treatments === null && documents === null) {
    const demo = demoSource()
    return { ...demo, patients: [patient] }
  }

  return {
    live: true,
    patients: [patient],
    appointments:
      appointmentFetch.source === "live"
        ? appointmentFetch.appointments.filter((a) => a.patientId === patient.id)
        : [],
    invoices:
      invoiceFetch.source === "live"
        ? invoiceFetch.invoices.filter((i) => i.patientId === patient.id)
        : [],
    treatmentsFor: () => treatments ?? [],
    documentsFor: () => documents ?? [],
    financesFor: () => [],
  }
}
