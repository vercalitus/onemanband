import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AccessToken, OutboxMessage, PatientResponse } from "@/types/automation"

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
/* Outbox                                                                      */
/* -------------------------------------------------------------------------- */

function toOutboxRow(message: OutboxMessage, clinicId: string) {
  return {
    clinic_id: clinicId,
    sequence_id: message.sequenceId,
    step_id: message.stepId,
    trigger: message.trigger,
    channel: message.channel,
    recipient: message.to,
    subject: message.subject ?? null,
    body: message.body,
    actions: message.actions,
    access_token: message.token ?? null,
    run_index: message.runIndex ?? null,
    scheduled_for: message.scheduledFor,
    status: message.status,
    sent_at: message.sentAt ?? null,
    error: message.error ?? null,
    external_patient_id: message.patientId || null,
    external_appointment_id: message.appointmentId ?? null,
    external_invoice_id: message.invoiceId ?? null,
  }
}

function fromOutboxRow(row: Record<string, unknown>): OutboxMessage {
  return {
    id: row.id as string,
    sequenceId: row.sequence_id as string,
    stepId: row.step_id as string,
    trigger: row.trigger as OutboxMessage["trigger"],
    channel: row.channel as OutboxMessage["channel"],
    patientId: (row.external_patient_id as string) ?? "",
    patientName: "",
    to: row.recipient as string,
    appointmentId: (row.external_appointment_id as string) ?? undefined,
    invoiceId: (row.external_invoice_id as string) ?? undefined,
    scheduledFor: row.scheduled_for as string,
    status: row.status as OutboxMessage["status"],
    subject: (row.subject as string) ?? undefined,
    body: row.body as string,
    actions: (row.actions as OutboxMessage["actions"]) ?? [],
    token: (row.access_token as string) ?? undefined,
    runIndex: (row.run_index as number) ?? undefined,
    createdAt: row.created_at as string,
    sentAt: (row.sent_at as string) ?? undefined,
    error: (row.error as string) ?? undefined,
  }
}

/**
 * Copy newly planned messages into the queue the cron reads.
 *
 * `ignoreDuplicates` leans on the unique index rather than checking first: two
 * tabs planning the same event at the same moment would both pass a check and
 * both insert. The database is the only place that can decide this once.
 */
export async function enqueueMessageRows(messages: OutboxMessage[]): Promise<number> {
  const db = createSupabaseAdminClient()
  const clinicId = await soleClinicId()
  if (!db || !clinicId || !messages.length) return 0

  const { data, error } = await db
    .from("automation_outbox")
    .upsert(
      messages.map((m) => toOutboxRow(m, clinicId)),
      { ignoreDuplicates: true, onConflict: "clinic_id,step_id,channel" },
    )
    .select("id")
  if (error) return 0
  return data?.length ?? 0
}

/** Everything whose moment has come and which has not been dealt with. */
export async function dueMessageRows(now: Date): Promise<OutboxMessage[]> {
  const db = createSupabaseAdminClient()
  if (!db) return []
  const { data } = await db
    .from("automation_outbox")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(200)
  return (data ?? []).map(fromOutboxRow)
}

/**
 * Stop everything still pending for one visit or one invoice.
 *
 * The mirror image of enqueueing, and just as load-bearing: a patient who
 * cancelled must not get "see you in an hour" an hour later, and someone who
 * has paid must not keep being chased. Cancelling locally is not enough once
 * the cron sends from the database.
 */
export async function cancelPendingRows(
  by: { appointmentId?: string; invoiceId?: string },
): Promise<number> {
  const db = createSupabaseAdminClient()
  if (!db) return 0

  let query = db
    .from("automation_outbox")
    .update({ status: "cancelled" })
    .eq("status", "pending")

  if (by.appointmentId) query = query.eq("external_appointment_id", by.appointmentId)
  else if (by.invoiceId) query = query.eq("external_invoice_id", by.invoiceId)
  // Without a target this would cancel the entire queue.
  else return 0

  const { data } = await query.select("id")
  return data?.length ?? 0
}

export async function updateMessageRow(
  id: string,
  patch: Partial<OutboxMessage>,
): Promise<void> {
  const db = createSupabaseAdminClient()
  if (!db) return
  await db
    .from("automation_outbox")
    .update({
      status: patch.status,
      sent_at: patch.sentAt ?? null,
      error: patch.error ?? null,
    })
    .eq("id", id)
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
