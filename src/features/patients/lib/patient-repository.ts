"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { PatientStatus, PatientSummary } from "@/types/domain"

/**
 * Patients, read from Postgres instead of the mock file.
 *
 * Read through the *browser* client, on the practitioner's own session, so
 * row-level security is what decides which clinic's patients come back. The
 * service-role client exists for the patient-facing routes, which have no
 * session at all; using it here would step around the only access control this
 * data has.
 *
 * Two fields on `PatientSummary` are deliberately not filled here:
 *
 *   - `lastVisit` comes from appointments
 *   - `balance` comes from finances
 *
 * Neither table is live yet. Rather than invent a plausible value, they come
 * back empty and the callers that care fall back to what they already do. They
 * fill in when those stages land, and nothing else has to change.
 */

export interface PatientDraft {
  fullName: string
  phone?: string
  email?: string
  address?: string
  status?: PatientStatus
  medicalHistorySummary?: string
  generalNotes?: string
  tags?: string[]
}

interface PatientRow {
  id: string
  full_name: string
  status: PatientStatus
  phone: string | null
  email: string | null
  address: string | null
  tags: string[] | null
  medical_history_summary: string | null
  general_notes: string | null
}

function toSummary(row: PatientRow): PatientSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    status: row.status,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? undefined,
    // Derived from tables that are not live yet — see the note above.
    lastVisit: "",
    balance: "",
    tags: row.tags ?? [],
    medicalHistorySummary: row.medical_history_summary ?? "",
    generalNotes: row.general_notes ?? "",
  }
}

export type PatientFetch =
  /** The database answered. An empty list is an answer, not a failure. */
  | { source: "live"; patients: PatientSummary[] }
  /** No database on this deploy, or it could not be read. */
  | { source: "unavailable"; reason: string }

export async function fetchPatients(): Promise<PatientFetch> {
  const db = createSupabaseBrowserClient()
  if (!db) return { source: "unavailable", reason: "supabase not configured" }

  const { data, error } = await db
    .from("patients")
    .select(
      "id, full_name, status, phone, email, address, tags, medical_history_summary, general_notes",
    )
    .order("full_name", { ascending: true })

  if (error) return { source: "unavailable", reason: error.message }
  return { source: "live", patients: (data as PatientRow[]).map(toSummary) }
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
      status: draft.status ?? "active",
      medical_history_summary: draft.medicalHistorySummary ?? "",
      general_notes: draft.generalNotes ?? "",
      tags: draft.tags ?? [],
    })
    .select(
      "id, full_name, status, phone, email, address, tags, medical_history_summary, general_notes",
    )
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, patient: toSummary(data as PatientRow) }
}
