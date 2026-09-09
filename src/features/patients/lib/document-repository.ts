"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { DocumentRecord, DocumentType } from "@/types/domain"

/**
 * A patient's documents, read from Postgres.
 *
 * Read on the practitioner's own session, so row-level security decides whose
 * records come back — the same rule as everywhere else. What comes back is
 * metadata only: names, types, dates and a storage path. The files themselves
 * live in a private bucket and are only ever reachable through a short-lived
 * signed URL the server mints, one at a time.
 */

interface DocumentRow {
  id: string
  file_name: string
  document_type: DocumentType
  created_at: string
  source_label: string | null
  storage_path: string
}

export async function fetchPatientDocuments(patientId: string): Promise<DocumentRecord[] | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const { data, error } = await db
    .from("documents")
    .select("id, file_name, document_type, created_at, source_label, storage_path")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  // Null rather than an empty list: "could not ask" and "has none" lead to
  // different behaviour upstream, and conflating them would hide the demo
  // dataset behind a failed request.
  if (error) return null

  return (data as DocumentRow[]).map((row) => ({
    id: row.id,
    name: row.file_name,
    type: row.document_type,
    uploadedAt: row.created_at,
    source: row.source_label ?? "",
    storagePath: row.storage_path,
  }))
}

/**
 * Every document in the clinic, grouped by patient — for the backup, which
 * needs all of them at once rather than one patient at a time. Paged, because
 * PostgREST stops at 1,000 rows without saying so and a backup that quietly
 * omits the rest is worse than one that fails.
 */
export async function fetchAllDocuments(): Promise<Map<string, DocumentRecord[]> | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const byPatient = new Map<string, DocumentRecord[]>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("documents")
      .select("patient_id, id, file_name, document_type, created_at, source_label, storage_path")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1)

    if (error) return null
    const rows = data as unknown as (DocumentRow & { patient_id: string })[]
    for (const row of rows) {
      const list = byPatient.get(row.patient_id) ?? []
      list.push({
        id: row.id,
        name: row.file_name,
        type: row.document_type,
        uploadedAt: row.created_at,
        source: row.source_label ?? "",
        storagePath: row.storage_path,
      })
      byPatient.set(row.patient_id, list)
    }
    if (rows.length < PAGE) break
  }
  return byPatient
}

/**
 * Remove a document for good: the file leaves the bucket, the row leaves the
 * table.
 *
 * The chart used to "delete" by adding the id to a list in localStorage. The
 * file stayed, the row stayed, and the document reappeared on the next device —
 * a bin that never emptied, which is worse than no bin, because it tells a
 * practitioner something is gone when it is not.
 *
 * The file goes first. A row with no file behind it shows an entry that will
 * not open; a file with no row is invisible and costs storage. Only one of
 * those is a lie to the person reading the chart.
 *
 * Both operations are governed by the same policies as everything else here:
 * only an admin of the owning clinic may delete, and only inside their own
 * clinic's folder. Nothing in this function decides that.
 */
export async function deleteDocument(
  documentId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const { data, error: readError } = await db
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle()

  if (readError) return { ok: false, reason: readError.message }
  if (!data?.storage_path) return { ok: false, reason: "document not found" }

  const { error: fileError } = await db.storage
    .from("patient-media")
    .remove([data.storage_path])
  if (fileError) return { ok: false, reason: fileError.message }

  const { error: rowError } = await db.from("documents").delete().eq("id", documentId)
  if (rowError) return { ok: false, reason: rowError.message }

  return { ok: true }
}

/** Above this a scan is a problem for the scanner, not for the chart. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

export type DocumentWrite =
  | { ok: true; document: DocumentRecord }
  | { ok: false; reason: string }

/**
 * File a document on a patient's chart: the file into the private bucket, then
 * the row that points at it.
 *
 * Until now nothing in the app could do this. The 801 documents on record were
 * imported by script, and a practitioner holding a new X-ray or a signed
 * consent form had nowhere to put it — the only upload path was the patient's
 * own, through a booking link. The chart is where the record is kept, so it is
 * where the record is added to.
 *
 * File first, row second: a row with no file behind it is an entry that will
 * not open, which lies to the reader; a file with no row is invisible and
 * costs storage. If the row is refused, the file is taken back out.
 *
 * Same policies as everything else: the clinic id comes from the caller's own
 * profile, storage refuses a path outside that clinic's folder, and the table
 * refuses an insert from anyone who is not a clinician there.
 */
export async function uploadDocument(
  patientId: string,
  file: File,
  type: DocumentType,
): Promise<DocumentWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, reason: "file too large" }

  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return { ok: false, reason: "not signed in" }
  const { data: profile } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", auth.user.id)
    .maybeSingle()
  const clinicId = profile?.clinic_id
  if (!clinicId) return { ok: false, reason: "no clinic for this user" }

  // The original name is kept on the row for display. The object key is
  // stamped and sanitised: a Hebrew file name is legitimate on a chart and a
  // poor storage key, and two scans called "xray.jpg" must not overwrite each
  // other.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const safe = file.name.replace(/[^\w.\-]+/g, "_")
  const path = `${clinicId}/${patientId}/documents/${stamp}-${safe}`

  const { error: fileError } = await db.storage
    .from("patient-media")
    .upload(path, file, { contentType: file.type || undefined })
  if (fileError) return { ok: false, reason: fileError.message }

  const { data, error: rowError } = await db
    .from("documents")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      uploaded_by: auth.user.id,
      bucket: "patient-media",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      document_type: type,
      source_label: "chart",
    })
    .select("id, file_name, document_type, created_at, source_label, storage_path")
    .single()

  if (rowError) {
    // Best effort; an orphaned file is the harmless half of this failure.
    await db.storage.from("patient-media").remove([path])
    return { ok: false, reason: rowError.message }
  }

  const row = data as DocumentRow
  return {
    ok: true,
    document: {
      id: row.id,
      name: row.file_name,
      type: row.document_type,
      uploadedAt: row.created_at,
      source: row.source_label ?? "",
      storagePath: row.storage_path,
    },
  }
}

/**
 * A link that opens one document, valid for about a minute.
 *
 * Minted by the server against the practitioner's session, never assembled
 * here: the bucket is private, and a URL the browser could construct on its own
 * would be a URL anyone could construct.
 */
export async function openDocument(documentId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/documents/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; url?: string }
    return body.ok ? (body.url ?? null) : null
  } catch {
    return null
  }
}
