import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  cancelPendingRows,
  enqueueMessageRows,
} from "@/features/automations/lib/server-store"
import type { OutboxMessage } from "@/types/automation"

/**
 * Mirror newly planned messages into the queue the cron reads.
 *
 * The engine still decides *what* to send in the practitioner's browser, and a
 * message that lives only there will never be sent: the reminder for 18:00 the
 * evening before is due precisely when nobody has the app open. So planning
 * stays where it is and the queue moves here.
 *
 * Session-gated by the middleware. Deciding that a patient should receive a
 * message is the clinic's act, and an open version of this would let anyone
 * put words into the clinic's mouth and have them delivered on a schedule.
 */

export const dynamic = "force-dynamic"

const messageSchema = z.object({
  id: z.string(),
  sequenceId: z.string(),
  stepId: z.string(),
  trigger: z.string(),
  channel: z.enum(["whatsapp", "email", "sms"]),
  patientId: z.string(),
  patientName: z.string().optional(),
  to: z.string().min(1),
  appointmentId: z.string().optional(),
  invoiceId: z.string().optional(),
  scheduledFor: z.string(),
  status: z.enum(["pending", "simulated", "sent", "failed", "cancelled"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  actions: z.array(z.string()),
  token: z.string().optional(),
  runIndex: z.number().optional(),
  createdAt: z.string(),
})

const bodySchema = z.object({ messages: z.array(messageSchema).max(100) })

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid messages" }, { status: 400 })
  }

  const queued = await enqueueMessageRows(
    parsed.data.messages as unknown as OutboxMessage[],
  )
  return NextResponse.json({ ok: true, queued })
}

const cancelSchema = z
  .object({
    appointmentId: z.string().min(1).optional(),
    invoiceId: z.string().min(1).optional(),
  })
  // One or the other, never neither: an empty target would mean "cancel
  // everything", which is not a thing any caller should be able to ask for by
  // omission.
  .refine((v) => Boolean(v.appointmentId) !== Boolean(v.invoiceId), {
    message: "name exactly one of appointmentId or invoiceId",
  })

/** Stop pending messages for a visit that was cancelled, or an invoice paid. */
export async function PATCH(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  const parsed = cancelSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid target" }, { status: 400 })
  }

  return NextResponse.json({ ok: true, cancelled: await cancelPendingRows(parsed.data) })
}
