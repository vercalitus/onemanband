"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { BodyMark3d, PatientStatus, PatientSummary } from "@/types/domain"

/**
 * Patients, read from Postgres instead of the mock file.
 *
 * Read through the *browser* client, on the practitioner's own session, so
 * row-level security is what decides which clinic's patients come back. The
 * service-role client exists for the patient-facing routes, which have no
 * session at all; using it here would step around the only access control this
 * data has.
 *
 * `balance` is deliberately left empty: it derives from finances, which holds
 * nothing until the clinic starts billing from here. Inventing a plausible
 * number would be worse than an absent one.
 */

export interface PatientDraft {
  fullName: string
  phone?: string
  email?: string
  address?: string
  dateOfBirth?: string
  status?: PatientStatus
  medicalHistorySummary?: string
  generalNotes?: string
  tags?: string[]
  /** The course agreed at intake. Absent means the practice default applies. */
  carePlanSessions?: number
}

interface PatientRow {
  id: string
  full_name: string
  status: PatientStatus
  phone: string | null
  email: string | null
  address: string | null
  date_of_birth: string | null
  sumit_customer_id: number | null
  tags: string[] | null
  medical_history_summary: string | null
  general_notes: string | null
  last_seen_at: string | null
  clinical_status: string | null
  clinical_status_updated_at: string | null
  body_map_3d: BodyMark3d[] | null
  care_plan_sessions: number | null
}

const COLUMNS =
  "id, full_name, status, phone, email, address, date_of_birth, sumit_customer_id, tags, medical_history_summary, general_notes, last_seen_at, clinical_status, clinical_status_updated_at, body_map_3d, care_plan_sessions"

function toSummary(row: PatientRow): PatientSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    status: row.status,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    sumitCustomerId: row.sumit_customer_id ?? undefined,
    /*
     * The best date anyone has. Backfilled at import from the bookkeeping
     * history: most patients here pay at the session, so the date of their
     * last document approximates their last visit, and for the years before
     * this app existed it is the only evidence there is. Empty when even that
     * is unknown, which the UI shows as a dash rather than a guess.
     *
     * Superseded by real appointments and payments as they accumulate.
     */
    lastVisit: row.last_seen_at ?? "",
    // Derived from finances, which is empty until the clinic bills from here.
    balance: "",
    tags: row.tags ?? [],
    medicalHistorySummary: row.medical_history_summary ?? "",
    generalNotes: row.general_notes ?? "",
    clinicalStatus: row.clinical_status ?? "",
    clinicalStatusUpdatedAt: row.clinical_status_updated_at ?? undefined,
    bodyMap3d: row.body_map_3d ?? [],
    carePlanSessions: row.care_plan_sessions ?? undefined,
  }
}

/**
 * Has this clinic entered real patients?
 *
 * The anchor for every other demo dataset. Each area used to decide on its own
 * table — schedule empty means show the demo day, ledger empty means show the
 * demo figures — which was right until the day patients arrived and the others
 * had not. Then the dashboard offered visits by people who do not exist, whose
 * names linked to records that were never there.
 *
 * Patients are the right anchor because nothing else in a clinic exists without
 * them. Once there is one, the invented material is gone everywhere, and empty
 * screens are the truth: no appointments have been booked yet.
 *
 * Cached for the page's lifetime — the answer flips once, on an import.
 */
let livePatientsAnswer: Promise<boolean> | null = null

export function clinicHasPatients(): Promise<boolean> {
  if (livePatientsAnswer) return livePatientsAnswer
  livePatientsAnswer = (async () => {
    const db = createSupabaseBrowserClient()
    if (!db) return false
    const { count, error } = await db
      .from("patients")
      .select("id", { count: "exact", head: true })
    // A failure is not evidence of an empty clinic, so it leaves the demo in
    // place rather than blanking the app.
    if (error) return false
    return (count ?? 0) > 0
  })()
  return livePatientsAnswer
}

export type PatientFetch =
  /** The database answered. An empty list is an answer, not a failure. */
  | { source: "live"; patients: PatientSummary[] }
  /** No database on this deploy, or it could not be read. */
  | { source: "unavailable"; reason: string }

/**
 * PostgREST caps a response at 1,000 rows and says nothing about it — the
 * request succeeds, the list is simply short. A clinic with 1,178 patients was
 * shown 1,000 of them and told it had 1,000, which is worse than an error
 * because nothing looks wrong. So the rows are paged explicitly.
 */
const PAGE = 1000

/**
 * Two providers ask for the whole list on the same page load — the one that
 * feeds every screen, and the one that derives the dashboard's signals. That is
 * 1,178 rows and about 400 KB fetched and parsed twice for the same answer.
 *
 * Callers that arrive while a read is already running share it. Deliberately
 * only that: once the read settles the next call goes to the database, so
 * nothing here can serve a patient record that has since been edited.
 */
let inFlight: Promise<PatientFetch> | null = null

export function fetchPatients(): Promise<PatientFetch> {
  if (!inFlight) {
    inFlight = readPatients().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function readPatients(): Promise<PatientFetch> {
  const db = createSupabaseBrowserClient()
  if (!db) return { source: "unavailable", reason: "supabase not configured" }

  const patients: PatientSummary[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("patients")
      .select(COLUMNS)
      .order("full_name", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) return { source: "unavailable", reason: error.message }
    const rows = data as PatientRow[]
    patients.push(...rows.map(toSummary))
    // A short page is the last page. Asking again after an exactly-full one
    // costs a round trip and removes the guesswork.
    if (rows.length < PAGE) break
  }

  return { source: "live", patients }
}

/**
 * The clinic this practitioner belongs to.
 *
 * Read from their own profile rather than passed in: a patient must land in
 * the clinic whose member is creating them, and letting a caller name the
 * clinic would be an invitation to name someone else's.
 */
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

export type PatientWrite =
  | { ok: true; patient: PatientSummary }
  | { ok: false; reason: string }

export async function createPatient(draft: PatientDraft): Promise<PatientWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const clinicId = await currentClinicId()
  if (!clinicId) return { ok: false, reason: "no clinic for this user" }

  const { data, error } = await db
    .from("patients")
    .insert({
      clinic_id: clinicId,
      full_name: draft.fullName,
      phone: draft.phone || null,
      email: draft.email || null,
      address: draft.address || null,
      // The dialog asked for it and then wrote it into the notes as prose.
      // The column existed the whole time.
      date_of_birth: draft.dateOfBirth || null,
      status: draft.status ?? "active",
      medical_history_summary: draft.medicalHistorySummary ?? "",
      general_notes: draft.generalNotes ?? "",
      tags: draft.tags ?? [],
      care_plan_sessions: draft.carePlanSessions ?? null,
    })
    .select(
      COLUMNS,
    )
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, patient: toSummary(data as PatientRow) }
}

/**
 * Everything the chart can change about a patient.
 *
 * Every one of these fields already had a column and an editor in the UI; what
 * was missing was the line between them. The chart wrote to localStorage, so a
 * corrected phone number lived in one browser: the reminder engine, which reads
 * this table, never saw it, and the same patient read differently on the clinic
 * machine and on a phone.
 *
 * Only the keys present are sent, so saving a contact card cannot blank a note
 * the caller never loaded.
 */
export interface PatientPatch {
  phone?: string
  email?: string
  address?: string
  medicalHistorySummary?: string
  generalNotes?: string
  status?: PatientStatus
  clinicalStatus?: string
  bodyMap3d?: BodyMark3d[]
  /** Null clears the plan and returns the chart to the practice default. */
  carePlanSessions?: number | null
}

/**
 * Remember which customer card in the bookkeeping system this patient is.
 *
 * Written once, the first time a document is filed for a patient who had no
 * card — SUMIT creates one and hands back its id, and without this the next
 * document would search by our identifier again. (It would find it, because
 * SUMIT stores the identifier on the card it made; this makes the link ours as
 * well as theirs, and it is what the backfill for the 519 existing cards
 * writes into.)
 *
 * Never overwrites: a patient whose card is already known is not re-pointed at
 * another one by a filing.
 */
export async function linkSumitCustomer(
  patientId: string,
  customerId: number,
): Promise<boolean> {
  const db = createSupabaseBrowserClient()
  if (!db || !Number.isFinite(customerId)) return false
  const { error } = await db
    .from("patients")
    .update({ sumit_customer_id: customerId })
    .eq("id", patientId)
    .is("sumit_customer_id", null)
  return !error
}

export async function updatePatient(id: string, patch: PatientPatch): Promise<PatientWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const fields: Record<string, unknown> = {}
  if (patch.phone !== undefined) fields.phone = patch.phone || null
  if (patch.email !== undefined) fields.email = patch.email || null
  if (patch.address !== undefined) fields.address = patch.address || null
  if (patch.medicalHistorySummary !== undefined) {
    fields.medical_history_summary = patch.medicalHistorySummary
  }
  if (patch.generalNotes !== undefined) fields.general_notes = patch.generalNotes
  if (patch.status !== undefined) fields.status = patch.status
  if (patch.bodyMap3d !== undefined) fields.body_map_3d = patch.bodyMap3d
  if (patch.carePlanSessions !== undefined) fields.care_plan_sessions = patch.carePlanSessions
  if (patch.clinicalStatus !== undefined) {
    fields.clinical_status = patch.clinicalStatus
    // Stamped here rather than by a trigger: the date is part of what the line
    // means, and it should move only when someone rewrites the status — not
    // when an unrelated field on the same row is saved.
    fields.clinical_status_updated_at = patch.clinicalStatus.trim()
      ? new Date().toISOString()
      : null
  }

  if (!Object.keys(fields).length) return { ok: false, reason: "nothing to update" }

  const { data, error } = await db
    .from("patients")
    .update(fields)
    .eq("id", id)
    .select(COLUMNS)
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, patient: toSummary(data as PatientRow) }
}
