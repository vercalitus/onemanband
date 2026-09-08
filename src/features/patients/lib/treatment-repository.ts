"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { AppointmentType, TreatmentRecord } from "@/types/domain"

/**
 * Treatment records — what happened at a visit.
 *
 * These are the clinical record. Until now a completed session was written to
 * localStorage: the note, the handwriting and the voice memo all lived in one
 * browser, so the same patient's history differed between the clinic machine
 * and a phone, and clearing site data destroyed it with nothing to restore
 * from.
 *
 * Read and written on the practitioner's own session, so row-level security
 * decides which clinic's history comes back.
 *
 * **Rows here cannot be changed or removed.** A database trigger refuses both —
 * see `treatments_immutable` in the schema. That is deliberate and it is why
 * the chart offers no delete on a saved session: a treatment record that can be
 * quietly rewritten is not a record. A correction is a new entry saying so.
 */

const PRIVATE_BUCKET = "patient-media"

/** Long enough to load a scan into a preview, short enough to be worthless if passed on. */
const ATTACHMENT_TTL_SECONDS = 300

interface TreatmentRow {
  id: string
  recorded_at: string
  title: string
  note: string
  metadata: { canvas_path?: string; audio_path?: string } | null
  profiles?: { full_name: string | null } | null
}

const SELECT = "id, recorded_at, title, note, metadata, profiles(full_name)"

function toRecord(row: TreatmentRow): TreatmentRecord {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    practitioner: row.profiles?.full_name ?? "",
    title: row.title,
    note: row.note,
    canvasPath: row.metadata?.canvas_path,
    audioPath: row.metadata?.audio_path,
  }
}

/**
 * Null rather than an empty list when the database cannot be asked: "has no
 * history" and "could not look" lead to different screens, and conflating them
 * would make a patient's chart look empty because a request failed.
 */
export async function fetchPatientTreatments(
  patientId: string,
): Promise<TreatmentRecord[] | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const { data, error } = await db
    .from("treatments")
    .select(SELECT)
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })

  if (error) return null
  return (data as unknown as TreatmentRow[]).map(toRecord)
}

/**
 * Every treatment record in the clinic, grouped by patient.
 *
 * For the backup, which needs all of them at once. Asking per patient would be
 * 1,178 round trips to build one file; PostgREST also caps a response at 1,000
 * rows and says nothing about it, so the rows are paged explicitly — a backup
 * that silently stops at a thousand records is worse than one that fails.
 */
export async function fetchAllTreatments(): Promise<Map<string, TreatmentRecord[]> | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const byPatient = new Map<string, TreatmentRecord[]>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("treatments")
      .select(`patient_id, ${SELECT}`)
      .order("recorded_at", { ascending: false })
      .range(from, from + PAGE - 1)

    if (error) return null
    const rows = data as unknown as (TreatmentRow & { patient_id: string })[]
    for (const row of rows) {
      const list = byPatient.get(row.patient_id) ?? []
      list.push(toRecord(row))
      byPatient.set(row.patient_id, list)
    }
    if (rows.length < PAGE) break
  }
  return byPatient
}

async function currentClinicAndUser(): Promise<{ clinicId: string; userId: string } | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", auth.user.id)
    .maybeSingle()
  if (!data?.clinic_id) return null
  return { clinicId: data.clinic_id, userId: auth.user.id }
}

/**
 * Attachments go to the same private bucket as documents, under the same
 * `<clinic>/<patient>/…` convention the storage policies key on. The clinic id
 * is read from the practitioner's own profile, never taken from a caller, so
 * a file cannot be written into another clinic's folder.
 */
async function uploadAttachment(
  clinicId: string,
  patientId: string,
  fileName: string,
  blob: Blob,
): Promise<string | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const path = `${clinicId}/${patientId}/sessions/${fileName}`
  const { error } = await db.storage.from(PRIVATE_BUCKET).upload(path, blob, { upsert: true })
  return error ? null : path
}

export interface TreatmentDraft {
  title: string
  note: string
  treatmentType: AppointmentType
  /** Rasterised handwriting from the session canvas, if anything was drawn. */
  canvas?: Blob | null
  /** The session's voice memo, if one was recorded. */
  audio?: Blob | null
}

export type TreatmentWrite =
  | { ok: true; treatment: TreatmentRecord }
  | { ok: false; reason: string }

export async function createTreatment(
  patientId: string,
  draft: TreatmentDraft,
): Promise<TreatmentWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const who = await currentClinicAndUser()
  if (!who) return { ok: false, reason: "no clinic for this user" }

  // Files first: the row is immutable once written, so it cannot be created and
  // then amended with the paths. An upload that succeeds beside a failed insert
  // leaves an unreferenced file, which is harmless; the reverse would leave a
  // record pointing at nothing.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const metadata: Record<string, string> = {}

  if (draft.canvas) {
    const path = await uploadAttachment(
      who.clinicId,
      patientId,
      `${stamp}-canvas.png`,
      draft.canvas,
    )
    if (path) metadata.canvas_path = path
  }
  if (draft.audio) {
    const path = await uploadAttachment(
      who.clinicId,
      patientId,
      `${stamp}-memo.webm`,
      draft.audio,
    )
    if (path) metadata.audio_path = path
  }

  const { data, error } = await db
    .from("treatments")
    .insert({
      clinic_id: who.clinicId,
      patient_id: patientId,
      provider_id: who.userId,
      title: draft.title,
      treatment_type: draft.treatmentType,
      note: draft.note,
      metadata,
    })
    .select(SELECT)
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, treatment: toRecord(data as unknown as TreatmentRow) }
}

/**
 * A link to one session attachment, valid for a few minutes.
 *
 * Two independent checks stand behind it: the path came from a treatment row
 * this session was allowed to read, and storage refuses to sign an object
 * outside the caller's own clinic folder. Neither relies on code here being
 * right about who may see what.
 */
export async function signAttachment(path: string): Promise<string | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data, error } = await db.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, ATTACHMENT_TTL_SECONDS)
  if (error || !data) return null
  return data.signedUrl
}
