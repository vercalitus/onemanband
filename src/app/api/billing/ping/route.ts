import { NextResponse } from "next/server"

import {
  documentsAreDrafts,
  getBillingProvider,
} from "@/features/finances/lib/provider-registry"

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
  const provider = getBillingProvider()
  const result = await provider.ping()

  return NextResponse.json({
    ok: result.ok,
    provider: provider.name,
    live: provider.live,
    /** True while documents are filed as drafts — no number, no tax event. */
    draftsOnly: documentsAreDrafts(),
    vatRate: result.vatRate ?? null,
    message: result.message,
    checkedAt: new Date().toISOString(),
  })
}
