"use client"

import { useEffect, useMemo, useState } from "react"

import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { fetchTreatmentCounts } from "@/features/patients/lib/treatment-repository"
import { readClinicSettings } from "@/lib/clinic-settings-storage"

/**
 * Where each patient stands in their care plan, for the appointment card.
 *
 * The practitioner's question, standing in front of someone, is "which visit
 * is this?" — the ninth of a plan of twelve is a different conversation from
 * the second. It was on the patient's chart and nowhere near the diary, so
 * answering it meant leaving the day he was looking at.
 *
 * Counted from `treatments`, which is where a session is a fact; a record
 * saved in error does not count, and `fetchTreatmentCounts` already excludes
 * it. The number on the card is the visit being booked — sessions done plus
 * this one — so the card for today's visit reads the same as the chart will
 * when it is closed.
 */
export interface PlanProgress {
  /** Sessions already recorded. */
  done: number
  /** The plan: this patient's own, or the practice-wide default. */
  target: number
  /** True when the target was set for this patient rather than inherited. */
  personal: boolean
}

/** Asked once per page: several views draw these cards from the same answer. */
let cached: Promise<Map<string, number> | null> | null = null

function loadCounts(): Promise<Map<string, number> | null> {
  if (!cached) cached = fetchTreatmentCounts()
  return cached
}

export function usePlanProgress(): Map<string, PlanProgress> {
  const patients = useMergedPatients()
  const [counts, setCounts] = useState<Map<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadCounts().then((map) => {
      if (!cancelled) setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const clinicDefault = useMemo(() => {
    try {
      return readClinicSettings().defaultPlanSessions ?? 10
    } catch {
      return 10
    }
  }, [])

  return useMemo(() => {
    const out = new Map<string, PlanProgress>()
    // No answer yet, or the question could not be asked: say nothing. A card
    // claiming "visit 1 of 10" for someone on their ninth is worse than a card
    // that is quiet about it.
    if (!counts) return out
    for (const p of patients) {
      out.set(p.id, {
        done: counts.get(p.id) ?? 0,
        target: p.carePlanSessions ?? clinicDefault,
        personal: p.carePlanSessions !== undefined,
      })
    }
    return out
  }, [counts, patients, clinicDefault])
}
