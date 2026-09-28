import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { phoneLinkGate } from "@/features/patients/lib/phone-link"

/**
 * The patients whose number the clinic is missing, with the guesses for each.
 *
 * Public by necessity: this is opened by the practitioner on his phone, from a
 * link, with no login — the same shape as the patient-facing pages. The secret
 * in the URL is the whole authorisation, so the answer carries the least that
 * makes the screen work: a name, when they were last seen, and numbers already
 * in his own address book. No clinical record, no address, nothing else.
 */

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const gate = phoneLinkGate(request.nextUrl.searchParams.get("token"))
  if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.reason }, { status: 403 })

  const db = createSupabaseAdminClient()
  if (!db) return NextResponse.json({ ok: false, reason: "no store" }, { status: 503 })

  const { data: requests, error } = await db
    .from("phone_requests")
    .select("patient_id, answered_at, answer")
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })

  const ids = (requests ?? []).map((r) => r.patient_id)
  if (!ids.length) return NextResponse.json({ ok: true, patients: [] })

  const [{ data: patients }, { data: candidates }] = await Promise.all([
    db.from("patients").select("id, full_name, phone, last_seen_at").in("id", ids),
    db.from("phone_candidates").select("patient_id, label, phone, rank").in("patient_id", ids),
  ])

  const byPatient = new Map<string, { label: string; phone: string }[]>()
  for (const c of (candidates ?? []).sort((a, b) => a.rank - b.rank)) {
    const list = byPatient.get(c.patient_id) ?? []
    list.push({ label: c.label, phone: c.phone })
    byPatient.set(c.patient_id, list)
  }

  const answered = new Map((requests ?? []).map((r) => [r.patient_id, r]))
  const rows = (patients ?? [])
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      lastVisit: p.last_seen_at ? String(p.last_seen_at).slice(0, 10) : null,
      // A number already on the record means this one is done, however it got there.
      done: Boolean((p.phone ?? "").trim()) || Boolean(answered.get(p.id)?.answered_at),
      saved: (p.phone ?? "").trim() || null,
      candidates: byPatient.get(p.id) ?? [],
    }))
    .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""))

  return NextResponse.json({ ok: true, patients: rows })
}
