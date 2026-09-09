"use client"

import { useCallback, useEffect, useState } from "react"

import { AUTOMATION_STORE_EVENT } from "@/features/automations/lib/automation-store"
import type { OutboxMessage } from "@/types/automation"

/**
 * Messages the cron could not send.
 *
 * They fail on the server, in the queue the cron drains; the browser's copy of
 * the queue never learns. Fetched the same way responses are — on mount, on
 * focus, on a store change — so a failure shows up on the board the next time
 * somebody looks at it.
 */
export function useRemoteFailures(): OutboxMessage[] {
  const [failed, setFailed] = useState<OutboxMessage[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/automations/outbox", { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { ok: boolean; failed?: OutboxMessage[] }
      if (body.ok && body.failed) setFailed(body.failed)
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

  return failed
}
