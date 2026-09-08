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
