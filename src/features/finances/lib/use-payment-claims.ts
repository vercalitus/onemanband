"use client"

import { useCallback, useEffect, useState } from "react"

import {
  AUTOMATION_STORE_EVENT,
  listResponses,
} from "@/features/automations/lib/automation-store"

/**
 * Patients who have told us they paid, and whom nobody has checked yet.
 *
 * This is a third state, not a shade of the first two. "Owes money" and
 * "settled" are facts the clinic knows; "says they paid" is a claim it has
 * received and not yet verified — and showing it as either of the other two
 * would be wrong in a way that costs something. Read as debt, the clinic
 * chases someone who already paid; read as settled, income goes undocumented
 * and no receipt is ever issued.
 *
 * A claim clears when the practitioner settles the invoice (which marks the
 * response handled), never on a timer.
 */
export function usePaymentClaims(): {
  /** Patient ids with an open claim. */
  patients: Set<string>
  /** Invoice ids with an open claim. */
  invoices: Set<string>
} {
  const read = useCallback(() => {
    const open = listResponses().filter((r) => r.kind === "payment_claimed" && !r.handled)
    return {
      patients: new Set(open.map((r) => r.patientId).filter(Boolean)),
      invoices: new Set(open.map((r) => r.invoiceId).filter(Boolean) as string[]),
    }
  }, [])

  // Starts empty and fills after mount: the store is localStorage in mock mode,
  // so reading during render would make the server and client disagree.
  const [claims, setClaims] = useState<{ patients: Set<string>; invoices: Set<string> }>({
    patients: new Set(),
    invoices: new Set(),
  })

  useEffect(() => {
    const refresh = () => setClaims(read())
    refresh()
    window.addEventListener(AUTOMATION_STORE_EVENT, refresh)
    return () => window.removeEventListener(AUTOMATION_STORE_EVENT, refresh)
  }, [read])

  return claims
}
