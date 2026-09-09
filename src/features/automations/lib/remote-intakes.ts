"use client"

import { useCallback, useEffect, useState } from "react"

import {
  AUTOMATION_STORE_EVENT,
  listIntakes,
  upsertIntake,
} from "@/features/automations/lib/automation-store"
import type { PatientIntake } from "@/types/automation"

/**
 * Self-registrations that arrived from a patient's phone.
 *
 * Same shape as `useRemoteResponses`, for the same reason: the local store
 * only ever holds what this browser did, and a patient registering on their
 * own device wrote to the database. Refetched on mount, on focus, and whenever
 * the local store changes — which is when the practitioner is actually looking.
 */
export function useRemoteIntakes(): PatientIntake[] {
  const [intakes, setIntakes] = useState<PatientIntake[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/automations/intakes", { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { ok: boolean; intakes?: PatientIntake[] }
      if (body.ok && body.intakes) setIntakes(body.intakes)
    } catch {
      /* offline, or no store on this deploy */
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener("focus", refresh)
    window.addEventListener(AUTOMATION_STORE_EVENT, refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener(AUTOMATION_STORE_EVENT, refresh)
    }
  }, [refresh])

  return intakes
}

/**
 * The intake became a patient. Closed in both places it can live — the local
 * store, for the demo, and the database, for a real one — and the store event
 * makes every open board re-read.
 */
export async function approveIntake(id: string, patientId?: string): Promise<void> {
  const local = listIntakes().find((intake) => intake.id === id)
  if (local) upsertIntake({ ...local, status: "approved" })

  try {
    await fetch("/api/automations/intakes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patientId }),
    })
  } catch {
    /* the row stays open and comes back on the next load; nothing is lost */
  }
  window.dispatchEvent(new Event(AUTOMATION_STORE_EVENT))
}
