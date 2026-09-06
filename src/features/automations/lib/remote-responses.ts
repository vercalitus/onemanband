"use client"

import { useCallback, useEffect, useState } from "react"

import { AUTOMATION_STORE_EVENT } from "@/features/automations/lib/automation-store"
import type { PatientResponse } from "@/types/automation"

/**
 * Patient taps that happened somewhere else.
 *
 * The local store only ever holds what this browser did. A patient answering a
 * reminder on their own phone writes to the database instead, so the
 * practitioner's app has to go and ask — this is that ask.
 *
 * Refetched on mount and whenever the tab regains focus, which is when a
 * practitioner actually looks. Not polled: a claim is not urgent to the second,
 * and a timer running all day on a dashboard nobody is watching is a cost with
 * no reader.
 */
export function useRemoteResponses(): PatientResponse[] {
  const [responses, setResponses] = useState<PatientResponse[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/automations/responses", { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { ok: boolean; responses?: PatientResponse[] }
      // Silence on failure is deliberate: with no database configured this
      // route is simply absent, and the app runs on the local store exactly as
      // it did before. A broken banner would be worse than nothing.
      if (body.ok && body.responses) setResponses(body.responses)
    } catch {
      /* offline, or no store on this deploy */
    }
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("focus", refresh)
    window.addEventListener(AUTOMATION_STORE_EVENT, refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener(AUTOMATION_STORE_EVENT, refresh)
    }
  }, [refresh])

  return responses
}

/**
 * Tell the server a claim has been answered, because the invoice was settled.
 * Fire and forget: the local store has already been updated, and a failure
 * here means the task reappears on the next load rather than anything lost.
 */
export function clearRemoteClaim(invoiceId: string): void {
  void fetch("/api/automations/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId }),
  }).catch(() => {})
}
