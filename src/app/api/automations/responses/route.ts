import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  listOpenResponseRows,
  markInvoiceResponsesHandled,
} from "@/features/automations/lib/server-store"

/**
 * What patients have done that nobody has dealt with yet.
 *
 * Session-gated by the middleware. This is the return leg of the crossing: the
 * tap was written on the patient's phone, and this is where the practitioner's
 * app picks it up — the dashboard task and the "says they paid" badge both
 * read from here.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, responses: await listOpenResponseRows() })
}

const handledSchema = z.object({ invoiceId: z.string().min(1) })

/**
 * Close the claims about one invoice, because the practitioner has settled it.
 * Keyed on the invoice rather than a response id: settling is the act that
 * answers the claim, and it happens without anyone looking at the queue.
 */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = handledSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 })
  }

  await markInvoiceResponsesHandled(parsed.data.invoiceId)
  return NextResponse.json({ ok: true })
}
