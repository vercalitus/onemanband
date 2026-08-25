import { NextResponse } from "next/server"

import { billingGate, getBillingProvider } from "@/features/finances/lib/provider-registry"

/**
 * Connection check for Settings → Integrations.
 *
 * Deliberately answers with the VAT rate the bookkeeping system is actually
 * applying. It is the cheapest call that proves the credentials work, and the
 * one number in this integration that must never be assumed — the state
 * changes it, and every invoice depends on it.
 *
 * Returns nothing secret: no key, no company id.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  const gate = billingGate()
  const provider = getBillingProvider()

  // Surfaced rather than hidden: a deploy holding billing credentials with no
  // login is misconfigured, and Settings is where someone would look.
  if (!gate.allowed) {
    return NextResponse.json({
      ok: false,
      provider: provider.name,
      live: false,
      draftsOnly: true,
      vatRate: null,
      message: gate.reason,
      checkedAt: new Date().toISOString(),
    })
  }

  const result = await provider.ping()

  return NextResponse.json({
    ok: result.ok,
    provider: provider.name,
    live: provider.live,
    /** True while documents are filed as drafts — no number, no tax event. */
    draftsOnly: gate.drafts,
    vatRate: result.vatRate ?? null,
    message: result.message,
    checkedAt: new Date().toISOString(),
  })
}
