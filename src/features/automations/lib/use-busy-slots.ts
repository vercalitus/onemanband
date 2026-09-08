"use client"

import { useEffect, useState } from "react"

import type { BusySlot } from "@/features/automations/lib/availability"
import { todaySchedule, weeklySchedule } from "@/lib/mock-data"

/**
 * What the clinic already has booked, for a page with no session.
 *
 * The patient-facing pages worked this out from the demo diary, so the slots
 * they offered were free in a week that does not exist. The server answers
 * instead, against the token the patient is holding, and answers with times
 * only.
 *
 * `null` while the answer is still coming: a slot picker must not draw the day
 * as wide open and then narrow it, because somebody will have tapped by then.
 * The demo diary stands in only when there is no database to ask.
 */
export function useBusySlots(token: string): BusySlot[] | null {
  const [busy, setBusy] = useState<BusySlot[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/automations/public/busy?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { ok: boolean; busy: BusySlot[] } | null) => {
        if (cancelled) return
        setBusy(body?.ok ? body.busy : [...todaySchedule, ...weeklySchedule])
      })
      .catch(() => {
        if (!cancelled) setBusy([...todaySchedule, ...weeklySchedule])
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return busy
}
