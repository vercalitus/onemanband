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
