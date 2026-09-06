import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { serverEnv } from "@/lib/env"

/**
 * Service-role client. **Bypasses RLS entirely.**
 *
 * There is one legitimate use for it here, and it is narrow: the patient-facing
 * pages have no session — a patient never gets an account, the token in the URL
 * is the whole authorisation — and `anon` deliberately has no table access at
 * all. So a patient's tap has to be written by the server, which means the
 * server has to check the token itself before writing anything.
 *
 * Every caller therefore owes the same discipline: resolve and validate the
 * token first, then write only the row that token is about. Nothing here may
 * take a patient id, an invoice id or a clinic id from a request body.
 */
let cached: SupabaseClient | null = null

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (cached) return cached
  const url = serverEnv.NEXT_PUBLIC_SUPABASE_URL
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  cached = createClient(url, key, {
    // No session to persist and none to refresh: this client is a machine.
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
