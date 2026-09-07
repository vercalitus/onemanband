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
