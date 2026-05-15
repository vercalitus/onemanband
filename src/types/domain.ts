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

export interface NewsArticle {
  id: string
  title: string
  source: string
  url: string
  keyword: string
  publishedAt: string
  summary: string
}
