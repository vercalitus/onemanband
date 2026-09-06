import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AccessToken, PatientResponse } from "@/types/automation"

/**
 * The part of the automation store that has to survive leaving one device.
 *
 * `automation-store.ts` keeps the whole engine in the browser, which is fine
 * for everything that starts and ends there. It is not fine for the two things
 * that cross: a link minted on the practitioner's machine has to resolve on the
 * patient's phone, and the patient's answer has to arrive back on the
 * practitioner's dashboard. Those two live here.
 *
 * Ids are written to the `external_*` bridge columns — see the migration for
 * why, and for the fact that this is temporary.
 */

/**
 * Which clinic a row belongs to.
 *
 * Single-clinic assumption, and it is the bridge showing again: the app has no
 * notion of clinic identity yet because its patients are mock data. Once
 * patients are real, the clinic comes from the session or the token, not from
 * "the only row in the table".
 */
async function soleClinicId(): Promise<string | null> {
  const db = createSupabaseAdminClient()
  if (!db) return null
  const { data } = await db.from("clinics").select("id").limit(1).maybeSingle()
  return data?.id ?? null
}

export function isServerStoreConfigured(): boolean {
  return createSupabaseAdminClient() !== null
}

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

export async function saveTokenRow(token: AccessToken): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const clinicId = await soleClinicId()
  if (!db || !clinicId) return false

  const { error } = await db.from("automation_access_tokens").upsert(
    {
      token: token.token,
      clinic_id: clinicId,
      kind: token.kind,
      external_patient_id: token.patientId ?? null,
      external_appointment_id: token.appointmentId ?? null,
      external_invoice_id: token.invoiceId ?? null,
      single_use: token.singleUse,
      expires_at: token.expiresAt,
      used_at: token.usedAt ?? null,
    },
    { onConflict: "token" },
  )
  return !error
}

/**
 * Look a token up. The stored row carries no snapshot of what the message
 * said, so the caller gets the capability and nothing more — which is all a
 * public page is entitled to read anyway.
 */
export async function findTokenRow(value: string): Promise<AccessToken | null> {
  const db = createSupabaseAdminClient()
  if (!db) return null

  const { data } = await db
    .from("automation_access_tokens")
    .select("*")
    .eq("token", value)
    .maybeSingle()
  if (!data) return null

  return {
    token: data.token,
    kind: data.kind,
    patientId: data.external_patient_id ?? undefined,
    appointmentId: data.external_appointment_id ?? undefined,
    invoiceId: data.external_invoice_id ?? undefined,
    singleUse: data.single_use,
    expiresAt: data.expires_at,
    usedAt: data.used_at ?? undefined,
    createdAt: data.created_at,
  }
}

export async function markTokenUsedRow(value: string): Promise<void> {
  const db = createSupabaseAdminClient()
  if (!db) return
  await db
    .from("automation_access_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", value)
}

/* -------------------------------------------------------------------------- */
/* Responses                                                                   */
/* -------------------------------------------------------------------------- */

export async function addResponseRow(response: PatientResponse): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const clinicId = await soleClinicId()
  if (!db || !clinicId) return false

  const { error } = await db.from("patient_responses").insert({
    clinic_id: clinicId,
    kind: response.kind,
    external_patient_id: response.patientId || null,
    external_appointment_id: response.appointmentId ?? null,
    external_invoice_id: response.invoiceId ?? null,
    patient_name: response.patientName || null,
    new_start: response.newStart ? `${response.newDate}T${response.newStart}` : null,
    handled: response.handled,
    received_at: response.receivedAt,
  })
  return !error
}

/** Everything still waiting on the practitioner. */
export async function listOpenResponseRows(): Promise<PatientResponse[]> {
  const db = createSupabaseAdminClient()
  if (!db) return []

  const { data } = await db
    .from("patient_responses")
    .select("*")
    .eq("handled", false)
    .order("received_at", { ascending: false })
    .limit(200)

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    patientId: row.external_patient_id ?? "",
    patientName: row.patient_name ?? "",
    appointmentId: row.external_appointment_id ?? undefined,
    invoiceId: row.external_invoice_id ?? undefined,
    receivedAt: row.received_at,
    handled: row.handled,
  }))
}

/**
 * Close every open response about one invoice. Keyed on the invoice rather
 * than a response id because the practitioner settles an invoice — they do not
 * think in terms of which message the claim arrived through.
 */
export async function markInvoiceResponsesHandled(invoiceId: string): Promise<void> {
  const db = createSupabaseAdminClient()
  if (!db) return
  await db
    .from("patient_responses")
    .update({ handled: true })
    .eq("external_invoice_id", invoiceId)
    .eq("handled", false)
}
