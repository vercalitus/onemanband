import "server-only"

import {
  DEFAULT_CLINIC_TIMEZONE,
  clinicDateTimeToUtc,
  clinicHhmm,
  clinicIsoDate,
} from "@/features/automations/lib/clinic-time"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type {
  AccessToken,
  OutboxMessage,
  PatientIntake,
  PatientResponse,
} from "@/types/automation"

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
 * One insert per message, and a duplicate is not a failure. This used to be an
 * upsert naming `clinic_id,step_id,channel` as the conflict target — a unique
 * constraint that migration 060 had already dropped in favour of an
 * expression index over the bridge columns. Postgres refuses an ON CONFLICT
 * that matches no constraint, the error was swallowed, and the function
 * returned 0 with a 200: every message the browser planned since then reached
 * this function and none reached the table. The cron was draining a queue
 * nothing could fill.
 *
 * The unique index still decides duplicates — two tabs planning the same
 * event at the same moment both insert, and the second gets 23505 — it just
 * cannot be named as a conflict target, so the answer is read from the error.
 */
export async function enqueueMessageRows(messages: OutboxMessage[]): Promise<number> {
  const db = createSupabaseAdminClient()
  const clinicId = await soleClinicId()
  if (!db || !clinicId || !messages.length) return 0

  let queued = 0
  for (const message of messages) {
    const { error } = await db.from("automation_outbox").insert(toOutboxRow(message, clinicId))
    if (!error) {
      queued += 1
      continue
    }
    // Already queued for this patient, visit and step. Not a failure.
    if (error.code === "23505") continue
    // Anything else is a message that will never be sent, and that must not
    // be quiet — it is precisely the failure this table exists to prevent.
    console.error(`[automations/outbox] could not queue ${message.trigger}/${message.channel}: ${error.message}`)
  }
  return queued
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

/**
 * Record something a patient wrote in their own words.
 *
 * Separate from `addResponseRow` because it arrives differently and is trusted
 * differently: there is no capability token behind it, only a phone number the
 * provider says it came from. So it is stored as an unattributed message
 * unless the number matches a link we sent, and it is never allowed to change
 * anything — it opens an item for a person to read, and that is all.
 */
export async function addInboundMessageRow(input: {
  fromAddress: string
  body: string
  patientId?: string
  patientName?: string
}): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const clinicId = await soleClinicId()
  if (!db || !clinicId) return false

  const { error } = await db.from("patient_responses").insert({
    clinic_id: clinicId,
    kind: "message",
    external_patient_id: input.patientId ?? null,
    patient_name: input.patientName ?? null,
    from_address: input.fromAddress,
    body: input.body,
    handled: false,
    received_at: new Date().toISOString(),
  })
  return !error
}

/**
 * The most recent link we sent to this number, used only to put a name to an
 * inbound message. A miss is fine — the message is still stored, just without
 * a patient attached.
 */
export async function patientForRecipient(
  recipient: string,
): Promise<{ patientId?: string } | null> {
  const db = createSupabaseAdminClient()
  if (!db) return null
  const { data } = await db
    .from("automation_outbox")
    .select("external_patient_id")
    .eq("recipient", recipient)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.external_patient_id) return null
  return { patientId: data.external_patient_id }
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
    body: row.body ?? undefined,
    fromAddress: row.from_address ?? undefined,
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

/* -------------------------------------------------------------------------- */
/* Failed sends                                                                */
/* -------------------------------------------------------------------------- */

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/**
 * Messages the cron tried to send and could not.
 *
 * The dashboard's "message failed to send" row read the browser's queue, and
 * the cron sends from this one — so a real failure landed here and the board
 * never heard of it. The patient simply did not turn up. Names are looked up
 * because the queue row holds only an id, and a row that says "0501234567
 * failed" asks the reader to go and find out who that is.
 */
export async function listFailedMessageRows(): Promise<OutboxMessage[]> {
  const db = createSupabaseAdminClient()
  if (!db) return []

  const { data } = await db
    .from("automation_outbox")
    .select("*")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(100)
  const rows = data ?? []
  if (!rows.length) return []

  const patientIds = [
    ...new Set(
      rows
        .map((row) => row.external_patient_id as string | null)
        .filter((id): id is string => !!id && isUuid(id)),
    ),
  ]
  const names = new Map<string, string>()
  if (patientIds.length) {
    const { data: patients } = await db
      .from("patients")
      .select("id, full_name")
      .in("id", patientIds)
    for (const p of patients ?? []) names.set(p.id, p.full_name)
  }

  return rows.map((row) => ({
    ...fromOutboxRow(row),
    patientName: names.get(row.external_patient_id as string) ?? "",
  }))
}

/* -------------------------------------------------------------------------- */
/* Self-registration                                                           */
/* -------------------------------------------------------------------------- */

const APPOINTMENT_TYPES = new Set(["first", "adjustments", "kupa"])

export type IntakeWrite = { ok: true; id: string } | { ok: false; reason: string }

/**
 * File what a patient wrote on `/book/<token>`.
 *
 * Until now the intake was written to the *patient's* browser and nowhere
 * else, and the dashboard row that says "approve new patient registration"
 * read the practitioner's. Every self-registration died on the phone it was
 * typed on, and the clinic never knew anyone had tried.
 *
 * The token decides the clinic and whether the link is still good. Nothing
 * else about the request is trusted: it is self-reported data from an
 * unauthenticated page, which is exactly why it lands here and not in
 * `patients`.
 */
export async function addIntakeRow(intake: PatientIntake): Promise<IntakeWrite> {
  const db = createSupabaseAdminClient()
  if (!db) return { ok: false, reason: "no store" }

  const { data: tokenRow } = await db
    .from("automation_access_tokens")
    .select("clinic_id, kind, expires_at, single_use, used_at")
    .eq("token", intake.token)
    .maybeSingle()
  if (!tokenRow) return { ok: false, reason: "unknown token" }
  if (tokenRow.kind !== "book") return { ok: false, reason: "wrong token kind" }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" }
  if (tokenRow.single_use && tokenRow.used_at) return { ok: false, reason: "used" }

  const requestedStart =
    intake.requestedDate && intake.requestedStart
      ? clinicDateTimeToUtc(
          DEFAULT_CLINIC_TIMEZONE,
          intake.requestedDate,
          intake.requestedStart,
        ).toISOString()
      : null

  const { data, error } = await db
    .from("patient_intakes")
    .insert({
      clinic_id: tokenRow.clinic_id,
      token: intake.token,
      full_name: intake.fullName,
      phone: intake.phone,
      email: intake.email || null,
      date_of_birth: intake.dateOfBirth || null,
      reason: intake.reason ?? "",
      document_paths: intake.documentNames ?? [],
      requested_type: APPOINTMENT_TYPES.has(intake.requestedType) ? intake.requestedType : null,
      requested_start: requestedStart,
      status: "submitted",
      submitted_at: intake.submittedAt ?? new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, id: data.id }
}

/** Registrations nobody has looked at yet. */
export async function listSubmittedIntakeRows(): Promise<PatientIntake[]> {
  const db = createSupabaseAdminClient()
  if (!db) return []

  const { data } = await db
    .from("patient_intakes")
    .select("*")
    .eq("status", "submitted")
    .order("created_at", { ascending: false })
    .limit(100)

  return (data ?? []).map((row) => {
    const start = row.requested_start ? new Date(row.requested_start) : null
    return {
      id: row.id,
      token: row.token ?? "",
      fullName: row.full_name,
      phone: row.phone,
      email: row.email ?? "",
      dateOfBirth: row.date_of_birth ?? undefined,
      reason: row.reason ?? "",
      documentNames: row.document_paths ?? [],
      requestedType: row.requested_type ?? "first",
      requestedDate: start ? clinicIsoDate(start, DEFAULT_CLINIC_TIMEZONE) : undefined,
      requestedStart: start ? clinicHhmm(start, DEFAULT_CLINIC_TIMEZONE) : undefined,
      status: row.status,
      createdAt: row.created_at,
      submittedAt: row.submitted_at ?? undefined,
    }
  })
}

/** The original file name, with the upload stamp taken back off. */
export const intakeFileName = (path: string) =>
  (path.split("/").pop() ?? path).replace(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-/, "")

/**
 * The intake became a patient record. The intake keeps pointing at it so the
 * origin of the record is never lost — a patient who registered themselves is
 * a different fact from one typed in at reception.
 *
 * What the patient attached moves with them: each file leaves the `intakes/`
 * folder for the patient's own, and gets the document row that makes it
 * appear on the chart. A file that will not move stays where it is and is
 * reported, rather than leaving a row pointing at nothing.
 */
export async function markIntakeApprovedRow(
  id: string,
  by: { patientId?: string; approvedBy?: string },
): Promise<boolean> {
  const db = createSupabaseAdminClient()
  if (!db) return false

  const patientId = by.patientId && isUuid(by.patientId) ? by.patientId : null

  if (patientId) {
    const { data: intake } = await db
      .from("patient_intakes")
      .select("clinic_id, document_paths")
      .eq("id", id)
      .maybeSingle()
    const paths = ((intake?.document_paths as string[] | undefined) ?? []).filter((p) =>
      p.includes("/intakes/"),
    )
    for (const from of paths) {
      const name = intakeFileName(from)
      const to = `${intake!.clinic_id}/${patientId}/documents/${from.split("/").pop()}`
      const moved = await db.storage.from("patient-media").move(from, to)
      if (moved.error) {
        console.error(`[intakes] could not move ${from}: ${moved.error.message}`)
        continue
      }
      const { error } = await db.from("documents").insert({
        clinic_id: intake!.clinic_id,
        patient_id: patientId,
        uploaded_by: by.approvedBy ?? null,
        bucket: "patient-media",
        storage_path: to,
        file_name: name,
        document_type: "other",
        source_label: "self-registration",
      })
      if (error) console.error(`[intakes] moved ${to} but could not file it: ${error.message}`)
    }
  }

  const { error } = await db
    .from("patient_intakes")
    .update({
      status: "approved",
      approved_patient_id: patientId,
      approved_by: by.approvedBy ?? null,
    })
    .eq("id", id)
  return !error
}
