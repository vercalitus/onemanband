export type StaffRole = "admin" | "doctor"

export type PatientStatus = "active" | "frozen" | "past"

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show"

export type AppointmentType = "first" | "adjustments" | "kupa"

/** Grid and validation: start times and duration align to this step. */
export const APPOINTMENT_SLOT_MINUTES = 5
export const MIN_APPOINTMENT_MINUTES = 5
export const MAX_APPOINTMENT_MINUTES = 60

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void"

export type PaymentStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "refunded"
  | "failed"

export type DocumentType =
  | "xray"
  | "mri"
  | "insurance"
  | "lab"
  | "consent"
  | "other"

export interface NavItem {
  href: string
  label: string
  icon: string
  description: string
}

export interface ScheduleItem {
  id: string
  patientId: string
  patientName: string
  /** ISO calendar date (YYYY-MM-DD) the visit belongs to. Drives day/week/month filtering. */
  date: string
  dayLabel: string
  provider: string
  start: string
  end: string
  status: AppointmentStatus
  treatment: string
  appointmentType: AppointmentType
}

/** Reactive = surfaced by account/system signals; Active = clinician-created on this board. */
export type TodoKind = "reactive" | "active"

export interface TodoItem {
  id: string
  title: string
  due: string
  priority: "low" | "medium" | "high"
  overdue?: boolean
  kind?: TodoKind
  completed?: boolean
}

export interface PulseMetric {
  id: string
  label: string
  value: string
  delta: string
  trend: "up" | "down" | "steady"
}

export interface PatientSummary {
  id: string
  fullName: string
  status: PatientStatus
  phone: string
  email: string
  address?: string
  lastVisit: string
  balance: string
  tags: string[]
  medicalHistorySummary: string
  generalNotes: string
}

export interface TreatmentRecord {
  id: string
  recordedAt: string
  practitioner: string
  title: string
  note: string
}

export interface DocumentRecord {
  id: string
  name: string
  type: DocumentType
  uploadedAt: string
  source: string
}

export interface FinanceRecord {
  id: string
  issuedAt: string
  description: string
  amount: string
  invoiceStatus: InvoiceStatus
  paymentStatus: PaymentStatus
}

/** Provider that issues / syncs invoices on the clinic's behalf. */
export type InvoiceProvider = "Green Invoice" | "Morning" | "Invoice4U"

/** Sync state of an invoice against the external provider. */
export type InvoiceSyncStatus = "synced" | "pending" | "failed"

/** Kinds of work that produced an invoice — drives the Insights breakdown. */
export type BillingTreatmentType = "first" | "adjustments" | "kupa"

/**
 * Billing-grade invoice record used by the Financial OS page. Numbers are
 * stored as raw numbers (not display strings) so KPI math doesn't need
 * parsing. `displayAmount` is precomputed for the UI to keep formatting
 * consistent everywhere.
 */
export interface BillingInvoice {
  id: string
  patientId: string
  patientName: string
  /** ISO date the invoice was issued (or null if it hasn't been issued yet). */
  issuedAt: string | null
  /** ISO date the invoice is due. */
  dueAt: string | null
  /** ISO date the invoice was actually paid (only when status === "paid"). */
  paidAt: string | null
  /** Amount in clinic currency. */
  amount: number
  /** Pre-formatted string for display, e.g. "₪120". */
  displayAmount: string
  status: InvoiceStatus
  paymentStatus: PaymentStatus
  treatmentType: BillingTreatmentType
  provider: InvoiceProvider
  syncStatus: InvoiceSyncStatus
}

/**
 * Patient-level snapshot for the Debtors list / Pending tab. Computed once
 * from the invoice list (a patient's balance = sum of unpaid + overdue).
 */
export interface BillingPatientSnapshot {
  patientId: string
  patientName: string
  /** Net balance; positive = owes us; negative = credit on account; 0 = settled. */
  balance: number
  displayBalance: string
  lastVisit: string | null
  status: PatientStatus
}

/**
 * "Visit completed but never invoiced". Surfaced in the Pending tab so the
 * clinician can generate an invoice with one click.
 */
export interface UninvoicedVisit {
  id: string
  patientId: string
  patientName: string
  /** ISO date the visit happened. */
  visitDate: string
  treatmentType: BillingTreatmentType
  /** Suggested amount, used to seed the invoice if the user clicks "Generate". */
  suggestedAmount: number
  suggestedDisplayAmount: string
}

export interface ProviderIntegration {
  provider: InvoiceProvider
  connected: boolean
  /** ISO timestamp of the most recent successful sync. */
  lastSyncAt: string
  autoSyncMinutes: number
}

/**
 * Scheduled visit in the next 7 days — used to estimate projected revenue
 * from the calendar mock (Financial OS → Advanced Insights).
 */
export interface ProjectedCalendarVisit {
  id: string
  date: string
  patientId: string
  patientName: string
  treatmentType: BillingTreatmentType
  estimatedAmount: number
}

export interface NewsArticle {
  id: string
  title: string
  /** Human-readable source name (kept for display + back-compat with older mock data). */
  source: string
  /** FK to ClinicalSource.id — drives sidebar filtering on the Clinical Feed page. */
  sourceId: string
  url: string
  keyword: string
  publishedAt: string
  summary: string
  /** Estimated reading minutes (optional; UI hides the chip when not provided). */
  readingMinutes?: number
}

export interface ClinicalSource {
  id: string
  name: string
  /** Optional home URL — shown as subtitle and used as a default link target. */
  url?: string
  /** Marks user-added sources so we can persist + later delete them separately. */
  custom?: boolean
}
