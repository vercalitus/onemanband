"use client"

import {
  DEFAULT_CLINIC_TIMEZONE,
  clinicDateTimeToUtc,
} from "@/features/automations/lib/clinic-time"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type {
  BillingInvoice,
  BillingTreatmentType,
  InvoiceProvider,
  InvoiceStatus,
  InvoiceSyncStatus,
  PaymentMethod,
  PaymentStatus,
  TaxDocumentLink,
  UninvoicedVisit,
} from "@/types/domain"

/**
 * Invoices, read from Postgres instead of the mock file.
 *
 * Money is stored in agorot — `amount_cents`, an integer. The app works in
 * shekels because that is what a price is, but the database must not, because
 * a float that is a hundredth off is a rounding error in a VAT return. The
 * conversion happens here and nowhere else.
 *
 * Read on the practitioner's session so row-level security decides whose
 * ledger this is.
 */

interface FinanceRow {
  id: string
  patient_id: string
  appointment_id: string | null
  amount_cents: number
  payment_status: PaymentStatus
  invoice_status: InvoiceStatus
  due_date: string | null
  issued_at: string | null
  paid_at: string | null
  treatment_type: BillingTreatmentType | null
  payment_method: PaymentMethod | null
  billing_provider: string | null
  sync_status: InvoiceSyncStatus
  sync_error: string | null
  tax_document: TaxDocumentLink | null
  patients?: { full_name: string } | null
}

const SELECT =
  "id, patient_id, appointment_id, amount_cents, payment_status, invoice_status, due_date, issued_at, paid_at, treatment_type, payment_method, billing_provider, sync_status, sync_error, tax_document, patients(full_name)"

const TZ = DEFAULT_CLINIC_TIMEZONE

/** Agorot on the wire, shekels in the app. */
const toShekels = (agorot: number) => agorot / 100
const toAgorot = (shekels: number) => Math.round(shekels * 100)

function toInvoice(row: FinanceRow, formatMoney: (n: number) => string): BillingInvoice {
  const amount = toShekels(row.amount_cents)
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patients?.full_name ?? "",
    issuedAt: row.issued_at,
    dueAt: row.due_date,
    paidAt: row.paid_at ? row.paid_at.slice(0, 10) : null,
    amount,
    displayAmount: formatMoney(amount),
    status: row.invoice_status,
    paymentStatus: row.payment_status,
    treatmentType: row.treatment_type ?? "adjustments",
    provider: (row.billing_provider as InvoiceProvider) ?? "SUMIT",
    syncStatus: row.sync_status,
    paymentMethod: row.payment_method ?? undefined,
    taxDocument: row.tax_document ?? undefined,
    syncError: row.sync_error ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
  }
}

export type InvoiceFetch =
  | { source: "live"; invoices: BillingInvoice[] }
  | { source: "unavailable"; reason: string }

export async function fetchInvoices(
  formatMoney: (n: number) => string,
): Promise<InvoiceFetch> {
  const db = createSupabaseBrowserClient()
  if (!db) return { source: "unavailable", reason: "supabase not configured" }

  const { data, error } = await db
    .from("finances")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return { source: "unavailable", reason: error.message }
  return {
    source: "live",
    invoices: (data as unknown as FinanceRow[]).map((row) => toInvoice(row, formatMoney)),
  }
}

/**
 * Visits that happened and were never billed.
 *
 * Derived rather than stored, because it is not a fact — it is the absence of
 * one. A completed appointment with no invoice against it is the clinic's
 * to-do list, and keeping it as its own table would mean two records that can
 * disagree about whether someone has been charged.
 */
export async function fetchUninvoicedVisits(
  formatMoney: (n: number) => string,
  suggestedPrice: (type: BillingTreatmentType) => number,
): Promise<UninvoicedVisit[]> {
  const db = createSupabaseBrowserClient()
  if (!db) return []

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString()

  const [visits, billed] = await Promise.all([
    db
      .from("appointments")
      .select("id, patient_id, start_time, appointment_type, patients(full_name)")
      .eq("status", "completed")
      .gte("start_time", since)
      .order("start_time", { ascending: false }),
    db.from("finances").select("appointment_id").not("appointment_id", "is", null),
  ])

  if (visits.error || !visits.data) return []
  const invoiced = new Set(
    (billed.data ?? []).map((row) => (row as { appointment_id: string }).appointment_id),
  )

  return (
    visits.data as unknown as {
      id: string
      patient_id: string
      start_time: string
      appointment_type: BillingTreatmentType
      patients?: { full_name: string } | null
    }[]
  )
    .filter((row) => !invoiced.has(row.id))
    .map((row) => {
      const amount = suggestedPrice(row.appointment_type)
      return {
        id: row.id,
        patientId: row.patient_id,
        patientName: row.patients?.full_name ?? "",
        visitDate: row.start_time.slice(0, 10),
        treatmentType: row.appointment_type,
        suggestedAmount: amount,
        suggestedDisplayAmount: formatMoney(amount),
      }
    })
}

/**
 * Which patients have something outstanding.
 *
 * Ids only. The header's search results need to know whether a name has money
 * against it, and pulling the whole ledger on every page to answer a yes-or-no
 * question per row would be a page-load's worth of work for a badge.
 */
export async function fetchPatientsWithOpenInvoices(): Promise<Set<string> | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const { data, error } = await db
    .from("finances")
    .select("patient_id")
    .neq("payment_status", "paid")
    .neq("payment_status", "refunded")
    .neq("invoice_status", "void")

  if (error) return null
  return new Set((data as { patient_id: string }[]).map((row) => row.patient_id))
}

/**
 * What one patient still owes, in shekels.
 *
 * Asked by the chart, which needs a number and not a ledger. Null when there is
 * no database to ask — a chart that cannot reach the ledger must not claim the
 * patient owes nothing.
 */
export async function fetchPatientOutstanding(patientId: string): Promise<number | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const { data, error } = await db
    .from("finances")
    .select("amount_cents, payment_status, invoice_status")
    .eq("patient_id", patientId)
    .neq("payment_status", "paid")
    .neq("payment_status", "refunded")
    .neq("invoice_status", "void")

  if (error) return null
  const rows = data as { amount_cents: number }[]
  return toShekels(rows.reduce((sum, row) => sum + row.amount_cents, 0))
}

async function currentClinicId(): Promise<string | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", auth.user.id)
    .maybeSingle()
  return data?.clinic_id ?? null
}

export type InvoiceWrite =
  | { ok: true; invoice: BillingInvoice }
  | { ok: false; reason: string }

/** `null` is an answer — no such invoice. A failed read is not. */
export type InvoiceLookup =
  | { ok: true; invoice: BillingInvoice | null }
  | { ok: false; reason: string }

/**
 * The invoice already raised for a visit, if there is one.
 *
 * `appointment_id` carries no unique constraint, so "one invoice per visit" is
 * a lookup here rather than a conflict the database would raise. Two tabs
 * completing the same visit in the same second is the race this does not
 * cover; one practitioner completing it twice — a double tap, a replayed
 * planner — is the one it does, and that is the one that happens.
 */
export async function findInvoiceByAppointment(
  appointmentId: string,
  formatMoney: (n: number) => string,
): Promise<InvoiceLookup> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const { data, error } = await db
    .from("finances")
    .select(SELECT)
    .eq("appointment_id", appointmentId)
    .neq("invoice_status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, invoice: data ? toInvoice(data as unknown as FinanceRow, formatMoney) : null }
}

/**
 * An invoice raised by hand for this patient on this day, with no visit
 * behind it. One per patient per day is the whole idempotency rule for a
 * manual charge — enough to stop a double tap from billing twice.
 */
export async function findManualInvoiceOn(
  patientId: string,
  issuedAt: string,
  formatMoney: (n: number) => string,
): Promise<InvoiceLookup> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const { data, error } = await db
    .from("finances")
    .select(SELECT)
    .eq("patient_id", patientId)
    .is("appointment_id", null)
    .eq("issued_at", issuedAt)
    .neq("invoice_status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, invoice: data ? toInvoice(data as unknown as FinanceRow, formatMoney) : null }
}

export async function createInvoice(
  input: {
    patientId: string
    appointmentId?: string
    amount: number
    treatmentType: BillingTreatmentType
    issuedAt: string
    dueAt?: string
  },
  formatMoney: (n: number) => string,
): Promise<InvoiceWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }
  const clinicId = await currentClinicId()
  if (!clinicId) return { ok: false, reason: "no clinic for this user" }

  const { data, error } = await db
    .from("finances")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      appointment_id: input.appointmentId ?? null,
      amount_cents: toAgorot(input.amount),
      balance_cents: toAgorot(input.amount),
      currency: "ILS",
      treatment_type: input.treatmentType,
      invoice_status: "issued",
      payment_status: "pending",
      issued_at: input.issuedAt,
      due_date: input.dueAt ?? null,
      billing_provider: "SUMIT",
      sync_status: "pending",
    })
    .select(SELECT)
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, invoice: toInvoice(data as unknown as FinanceRow, formatMoney) }
}

/**
 * Record that an invoice was settled, and against which document.
 *
 * Written after the filing attempt rather than before, and it stores the
 * outcome either way: an invoice can be paid and its document still missing,
 * and pretending otherwise would leave income with no receipt and nobody
 * knowing. `syncStatus` carries that separately from `paymentStatus` for
 * exactly this reason.
 */
export async function settleInvoiceRow(
  input: {
    id: string
    amount: number
    method: PaymentMethod
    paidAt: string
    syncStatus: InvoiceSyncStatus
    taxDocument?: TaxDocumentLink
    syncError?: string
  },
  formatMoney: (n: number) => string,
): Promise<InvoiceWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const { data, error } = await db
    .from("finances")
    .update({
      amount_cents: toAgorot(input.amount),
      balance_cents: 0,
      payment_status: "paid",
      invoice_status: "paid",
      // Through the clinic's timezone, not the machine's. `new Date("...T00:00:00")`
      // means midnight wherever the browser happens to be, so a practitioner
      // settling an invoice from abroad would date the payment to the wrong
      // day — and a payment date is what decides which month's VAT it lands in.
      paid_at: clinicDateTimeToUtc(TZ, input.paidAt, "00:00").toISOString(),
      payment_method: input.method,
      sync_status: input.syncStatus,
      sync_error: input.syncError ?? null,
      tax_document: input.taxDocument ?? null,
    })
    .eq("id", input.id)
    .select(SELECT)
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, invoice: toInvoice(data as unknown as FinanceRow, formatMoney) }
}
