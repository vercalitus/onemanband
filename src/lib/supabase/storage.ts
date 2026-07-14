// This module must never be imported from client components: it uses the
// server Supabase client (cookies) and mints signed URLs. It has no "use client"
// and imports server-only APIs, so bundling it into a client component errors.
import { createSupabaseServerClient } from "@/lib/supabase/server"

/** Private bucket holding patient imaging and documents. See supabase/storage.sql. */
export const PATIENT_MEDIA_BUCKET = "patient-media"

/** Signed URLs are deliberately short-lived so a leaked link expires fast. */
export const SIGNED_URL_TTL_SECONDS = 60

/**
 * Object path for a patient's file. First segment is the clinic id — the
 * storage RLS policies key off it, so files are isolated per clinic.
 */
export function patientMediaPath(clinicId: string, patientId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, "_")
  return `${clinicId}/${patientId}/${safe}`
}

/**
 * Mint a short-lived signed URL for a private object. Returns null when
 * Supabase isn't configured or the caller's session can't see the object
 * (RLS denies it). Never returns a public URL — the bucket is private.
 */
export async function createSignedMediaUrl(
  path: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(PATIENT_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}

/**
 * Upload a patient file to the private bucket. RLS ensures the caller may only
 * write under their own clinic's folder. Returns the stored path or null.
 */
export async function uploadPatientMedia(
  clinicId: string,
  patientId: string,
  file: File | Blob,
  fileName: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null
  const path = patientMediaPath(clinicId, patientId, fileName)
  const { error } = await supabase.storage
    .from(PATIENT_MEDIA_BUCKET)
    .upload(path, file, { upsert: true })
  if (error) return null
  return path
}
