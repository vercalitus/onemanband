// Server-only: uses the cookie-bound Supabase client. Writes are also produced
// automatically by DB triggers (see supabase/audit.sql); this helper covers the
// cases triggers can't — reads/views and exports — for when the app reads live
// data. Never import from a client component.
import { createSupabaseServerClient } from "@/lib/supabase/server"

/** SELECTs don't fire triggers, so views/exports are logged from app code. */
export type AuditAction = "view" | "export"

/** Audited resources, matching the table names used by the DB triggers. */
export type AuditEntity =
  | "patients"
  | "treatments"
  | "appointments"
  | "documents"
  | "finances"
  | "patient-media"

/**
 * Record a read/view/export in the audit log. clinic_id and actor_id are filled
 * by column defaults (current_user_clinic_id() / auth.uid()), so the caller only
 * says what was accessed. Best-effort: never throws into the request path.
 */
export async function logAudit(
  action: AuditAction,
  entityType: AuditEntity,
  entityId?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    if (!supabase) return
    await supabase.from("audit_log").insert({
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      metadata,
    })
  } catch {
    // Auditing must never break the operation being audited.
  }
}
