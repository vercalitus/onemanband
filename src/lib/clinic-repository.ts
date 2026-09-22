"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * The clinic's own record.
 *
 * Its name was a default in the settings file — "Serene Spine Clinic" — which
 * is the demo's. It sat in the sidebar of a real clinic every day, and worse,
 * the public booking page reads the same settings from the *patient's*
 * browser, where nothing has ever been saved: a patient picking a time was
 * shown the name of a practice that does not exist.
 *
 * The clinic is a row. Its name comes from there, and a name nobody has typed
 * is empty rather than invented.
 */

let cached: Promise<string | null> | null = null

async function read(): Promise<string | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data: profile } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", auth.user.id)
    .maybeSingle()
  if (!profile?.clinic_id) return null
  const { data, error } = await db
    .from("clinics")
    .select("name")
    .eq("id", profile.clinic_id)
    .maybeSingle()
  // A failed read is not an unnamed clinic: null leaves whatever is on screen
  // alone rather than blanking the name on a timeout.
  if (error) return null
  return (data?.name as string | undefined)?.trim() || null
}

/** Cached for the life of the page — the clinic does not rename mid-session. */
export function fetchClinicName(): Promise<string | null> {
  cached ??= read()
  return cached
}
