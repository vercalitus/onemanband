import { dueMessages, updateOutboxMessage } from "@/features/automations/lib/automation-store"
import type { MessageChannel, OutboxMessage } from "@/types/automation"

/**
 * Delivery boundary.
 *
 * This is the one file that changes when a real WhatsApp / email provider is
 * wired. Everything upstream — sequences, scheduling, tokens, public pages —
 * is provider-agnostic and already finished.
 *
 * Today the only implementation is `SimulatedDispatcher`, which validates the
 * message and marks it `simulated`. That is a truthful terminal state, not a
 * pretend success: the queue shows exactly what would have gone out.
 */

export interface DispatchResult {
  ok: boolean
  /** Provider-side message id, when the transport returns one. */
  providerMessageId?: string
  error?: string
}

export interface MessageDispatcher {
  /** Short id shown in the UI, e.g. "simulated" or "twilio". */
  readonly name: string
  readonly channels: MessageChannel[]
  send(message: OutboxMessage): Promise<DispatchResult>
}

/** Rejects what a real provider would also reject, so bugs surface now. */
function validate(message: OutboxMessage): string | null {
  if (!message.to?.trim()) return "missing recipient"
  if (!message.body?.trim()) return "empty body"
  if (message.channel === "email" && !message.to.includes("@")) return "recipient is not an email"
  if (message.channel !== "email" && !/^[+\d][\d\s()-]{6,}$/.test(message.to)) {
    return "recipient is not a phone number"
  }
  // Anything still wrapped in braces means the context was missing a value.
  const unresolved = message.body.match(/\{(\w+)\}/g)
  if (unresolved?.length) return `unresolved placeholders: ${unresolved.join(", ")}`
  return null
}

export class SimulatedDispatcher implements MessageDispatcher {
  readonly name = "simulated"
  readonly channels: MessageChannel[] = ["whatsapp", "email", "sms"]

  async send(message: OutboxMessage): Promise<DispatchResult> {
    const problem = validate(message)
    if (problem) return { ok: false, error: problem }
    return { ok: true, providerMessageId: `sim_${message.id}` }
  }
}

/**
 * Live providers plug in here.
 *
 * WhatsApp specifically needs more than an HTTP call: interactive buttons
 * require message templates pre-approved by Meta, and button taps arrive on
 * the inbound webhook (`/api/automations/webhook/whatsapp`) rather than as a
 * response to the send. `OutboxMessage.actions` + `token` already carry
 * everything such a template needs.
 */
let activeDispatcher: MessageDispatcher = new SimulatedDispatcher()

export function setDispatcher(dispatcher: MessageDispatcher): void {
  activeDispatcher = dispatcher
}

export function getDispatcher(): MessageDispatcher {
  return activeDispatcher
}

/**
 * Where the queue lives for one run of the tick.
 *
 * Two answers, and the difference is the whole point: in the browser it is
 * localStorage, which only ever holds what this machine planned; on the server
 * it is Postgres, which is the only copy a cron can reach at three in the
 * morning with every browser closed.
 */
export interface MessageQueue {
  due(now: Date): Promise<OutboxMessage[]> | OutboxMessage[]
  update(id: string, patch: Partial<OutboxMessage>): Promise<void> | void
}

const localQueue: MessageQueue = {
  due: (now) => dueMessages(now),
  update: (id, patch) => updateOutboxMessage(id, patch),
}

export interface TickSummary {
  processed: number
  sent: number
  failed: number
  simulated: boolean
  dispatcher: string
}

/**
 * Deliver everything that has come due.
 *
 * Safe to call repeatedly: only `pending` rows past their `scheduledFor` are
 * touched, and each is moved to a terminal state before the next call.
 * Failures are recorded rather than retried — with no provider there is
 * nothing meaningful to retry against, and silent retry loops hide real
 * configuration errors.
 */
export async function runTick(
  now: Date = new Date(),
  /**
   * Passed in by the server, which is the only place the live providers exist:
   * their credentials can send mail and bill messages in the clinic's name, so
   * they must never be reachable from a module the browser bundles. The
   * Settings queue card calls this with nothing and gets the simulator.
   */
  dispatcher: MessageDispatcher = getDispatcher(),
  queue: MessageQueue = localQueue,
): Promise<TickSummary> {
  const simulated = dispatcher.name === "simulated"
  const due = await queue.due(now)
  let sent = 0
  let failed = 0

  for (const message of due) {
    const result = await dispatcher.send(message)
    if (result.ok) {
      sent += 1
      await queue.update(message.id, {
        status: simulated ? "simulated" : "sent",
        sentAt: new Date().toISOString(),
      })
    } else {
      failed += 1
      await queue.update(message.id, { status: "failed", error: result.error })
    }
  }

  return { processed: due.length, sent, failed, simulated, dispatcher: dispatcher.name }
}
