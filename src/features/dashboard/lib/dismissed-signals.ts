"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * Signals the practitioner has waved away.
 *
 * The attention column is *derived* from clinic data, so "done" is the wrong
 * verb for it: ticking "invoice overdue" does not pay the invoice, and the
 * signal reappears the moment the board re-derives. Dismissal is the honest
 * action — "I've seen this, stop showing it".
 *
 * Kept in the clinic's database, not the browser. It used to be localStorage,
 * which meant waving a signal away on a phone left it standing on the clinic
 * machine and the same alert had to be dismissed once per device, forever.
 * localStorage remains the fallback for a deploy with no database, so the demo
 * still behaves.
 *
 * Dismissals are self-cleaning: a signal that stops being derived (the invoice
 * got paid) drops out of the record, so if the same condition returns later it
 * is shown again rather than staying silently suppressed.
 */

const KEY = "clinic.dismissed-signals.v1"

export const DISMISSED_SIGNALS_EVENT = "dismissed-signals-changed"

const announce = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DISMISSED_SIGNALS_EVENT))
}

/* -------------------------------------------------------------------------- */
/* Local fallback — a deploy with no database                                  */
/* -------------------------------------------------------------------------- */

function readLocal(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(KEY)
    return new Set(Object.keys(raw ? (JSON.parse(raw) as Record<string, string>) : {}))
  } catch {
    return new Set()
  }
}

function writeLocal(ids: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    const record: Record<string, string> = {}
    const now = new Date().toISOString()
    for (const id of ids) record[id] = now
    window.localStorage.setItem(KEY, JSON.stringify(record))
    announce()
  } catch {
    /* quota / private mode */
  }
}

/* -------------------------------------------------------------------------- */
/* The clinic's record                                                         */
/* -------------------------------------------------------------------------- */

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

/** Null when there is no database to ask — the caller then uses the local set. */
export async function fetchDismissals(): Promise<Set<string> | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data, error } = await db.from("signal_dismissals").select("signal_id")
  if (error) return null
  return new Set((data as { signal_id: string }[]).map((row) => row.signal_id))
}

export async function dismissSignal(id: string): Promise<void> {
  const db = createSupabaseBrowserClient()
  if (!db) {
    writeLocal(new Set([...readLocal(), id]))
    return
  }
  const [clinicId, { data: auth }] = await Promise.all([currentClinicId(), db.auth.getUser()])
  if (!clinicId) {
    writeLocal(new Set([...readLocal(), id]))
    return
  }
  // Upsert rather than insert: dismissing something already dismissed is a
  // double-tap, not an error.
  await db
    .from("signal_dismissals")
    .upsert(
      { clinic_id: clinicId, signal_id: id, dismissed_by: auth.user?.id ?? null },
      { onConflict: "clinic_id,signal_id" },
    )
  announce()
}

export async function restoreSignal(id: string): Promise<void> {
  const db = createSupabaseBrowserClient()
  if (!db) {
    const local = readLocal()
    local.delete(id)
    writeLocal(local)
    return
  }
  await db.from("signal_dismissals").delete().eq("signal_id", id)
  announce()
}

/**
 * Drop dismissals whose signal is no longer being derived, and return what is
 * left.
 *
 * **Only call this once the board is showing the clinic's real signals.** The
 * live derivation is asynchronous, so for a moment after load the derived list
 * is empty or still the demo's — pruning against that would delete every real
 * dismissal and the alerts would all come back, which is precisely the bug this
 * record exists to prevent.
 */
export async function pruneDismissals(liveIds: string[]): Promise<Set<string>> {
  const live = new Set(liveIds)
  const db = createSupabaseBrowserClient()

  if (!db) {
    const local = readLocal()
    const kept = new Set([...local].filter((id) => live.has(id)))
    if (kept.size !== local.size) writeLocal(kept)
    return kept
  }

  const stored = await fetchDismissals()
  if (!stored) return new Set()

  const stale = [...stored].filter((id) => !live.has(id))
  if (stale.length) {
    await db.from("signal_dismissals").delete().in("signal_id", stale)
  }
  return new Set([...stored].filter((id) => live.has(id)))
}
