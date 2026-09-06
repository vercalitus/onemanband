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

export async function fetchPatients(): Promise<PatientFetch> {
  const db = createSupabaseBrowserClient()
  if (!db) return { source: "unavailable", reason: "supabase not configured" }

  const patients: PatientSummary[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("patients")
      .select(
        "id, full_name, status, phone, email, address, tags, medical_history_summary, general_notes",
      )
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
