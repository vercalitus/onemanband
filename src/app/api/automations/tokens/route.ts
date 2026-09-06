import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { saveTokenRow } from "@/features/automations/lib/server-store"
import type { AccessToken } from "@/types/automation"

/**
 * Mirror a freshly minted capability link to the database.
 *
 * The engine still plans messages in the practitioner's browser, so links are
 * minted there. A link that only exists in that browser cannot be opened on a
 * patient's phone, which is the entire point of it — so every mint is copied
 * here.
 *
 * Session-gated by the middleware: minting links is the clinic's business.
 * An open version of this endpoint would let anyone manufacture a working
 * capability for any patient id they cared to name.
 */

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  token: z.string().min(8),
  kind: z.enum(["book", "respond", "questionnaire", "invoice"]),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  invoiceId: z.string().optional(),
  questionnaireId: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
  singleUse: z.boolean(),
})

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid token" }, { status: 400 })
  }

  const ok = await saveTokenRow(parsed.data as AccessToken)
  // 503 rather than 500: nothing is wrong with the request, the store simply
  // is not there. The caller treats it as "stayed local" and carries on.
  return NextResponse.json({ ok }, { status: ok ? 200 : 503 })
}
