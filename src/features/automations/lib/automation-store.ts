import type {
  AccessToken,
  OutboxMessage,
  PatientIntake,
  PatientResponse,
  ProgressQuestionnaire,
} from "@/types/automation"

/**
 * Persistence for everything the automation engine produces.
 *
 * Mock-mode reality: the browser keeps this in `localStorage`, so the clinic
 * app and the patient-facing public pages share one store as long as they are
 * the same browser — which is exactly the demo path. On the server (API routes,
 * cron tick) there is no localStorage, so a module-level map stands in; it is
 * per-instance and resets on redeploy, and that is fine because nothing
 * durable is supposed to live there yet.
 *
 * Swapping in Supabase means reimplementing this one module against the
 * `automation_*` tables. Nothing above it needs to change.
 */

const KEY = "clinic.automations.v1"

interface StoreShape {
  outbox: OutboxMessage[]
  tokens: AccessToken[]
  intakes: PatientIntake[]
  questionnaires: ProgressQuestionnaire[]
  responses: PatientResponse[]
  /**
   * Instant the no-show watcher first ran. Visits that ended before it are
   * never auto-marked — the system should not invent history for appointments
   * it was not watching, which would otherwise bill every stale seed row the
   * moment the feature ships.
   */
  noShowWatermark?: string
  /** Questionnaire ids already filed into a patient's timeline. */
  filedQuestionnaires?: string[]
}

const emptyStore = (): StoreShape => ({
  outbox: [],
  tokens: [],
  intakes: [],
  questionnaires: [],
  responses: [],
  filedQuestionnaires: [],
})

/** Server-side stand-in for localStorage. Per-instance, non-durable. */
let memoryStore: StoreShape = emptyStore()

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined"

/** Fired after every write so open views can re-read without polling. */
export const AUTOMATION_STORE_EVENT = "automation-store-changed"

export function readStore(): StoreShape {
  if (!isBrowser()) return memoryStore
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<StoreShape>
    return { ...emptyStore(), ...parsed }
  } catch {
    return emptyStore()
  }
}

export function writeStore(next: StoreShape): void {
  if (!isBrowser()) {
    memoryStore = next
    return
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(AUTOMATION_STORE_EVENT))
  } catch {
    /* quota / private mode — the queue is best-effort in mock mode */
  }
}

function mutate(fn: (s: StoreShape) => StoreShape): StoreShape {
  const next = fn(readStore())
  writeStore(next)
  return next
}

/* -------------------------------------------------------------------------- */
/* Ids                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Random id. `crypto.randomUUID` where available; the fallback is only for
 * ancient runtimes and is never used for anything security-bearing beyond a
 * mock token.
 */
export function randomId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `${prefix}_${rand.slice(0, 24)}`
}

/* -------------------------------------------------------------------------- */
/* Outbox                                                                      */
/* -------------------------------------------------------------------------- */

export function listOutbox(): OutboxMessage[] {
  return readStore().outbox
}

/**
 * Append messages, skipping any (sequence, step, appointment/invoice, run)
 * combination already queued. Re-running the planner for the same event is
 * therefore safe — important because the tick route is idempotent by design.
 */
export function enqueueMessages(messages: OutboxMessage[]): OutboxMessage[] {
  if (!messages.length) return []
  let added: OutboxMessage[] = []
  mutate((s) => {
    const seen = new Set(
      s.outbox.map((m) => `${m.stepId}|${m.channel}|${m.appointmentId ?? ""}|${m.invoiceId ?? ""}|${m.runIndex ?? 0}`),
    )
    added = messages.filter((m) => {
      const key = `${m.stepId}|${m.channel}|${m.appointmentId ?? ""}|${m.invoiceId ?? ""}|${m.runIndex ?? 0}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return { ...s, outbox: [...s.outbox, ...added] }
  })
  return added
}

export function updateOutboxMessage(id: string, patch: Partial<OutboxMessage>): void {
  mutate((s) => ({
    ...s,
    outbox: s.outbox.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  }))
}

/**
 * Cancel everything still pending for an appointment. Called when a visit is
 * cancelled or moved — a patient who cancelled must not get "see you in an
 * hour" an hour later.
 */
export function cancelPendingForAppointment(appointmentId: string): number {
  let count = 0
  mutate((s) => ({
    ...s,
    outbox: s.outbox.map((m) => {
      if (m.appointmentId === appointmentId && m.status === "pending") {
        count += 1
        return { ...m, status: "cancelled" as const }
      }
      return m
    }),
  }))
  return count
}

/** Cancel pending dunning once an invoice settles. */
export function cancelPendingForInvoice(invoiceId: string): number {
  let count = 0
  mutate((s) => ({
    ...s,
    outbox: s.outbox.map((m) => {
      if (m.invoiceId === invoiceId && m.status === "pending") {
        count += 1
        return { ...m, status: "cancelled" as const }
      }
      return m
    }),
  }))
  return count
}

export function dueMessages(now: Date = new Date()): OutboxMessage[] {
  const cutoff = now.getTime()
  return readStore().outbox.filter(
    (m) => m.status === "pending" && new Date(m.scheduledFor).getTime() <= cutoff,
  )
}

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

export function saveToken(token: AccessToken): AccessToken {
  mutate((s) => ({ ...s, tokens: [...s.tokens.filter((t) => t.token !== token.token), token] }))
  return token
}

export function findToken(value: string): AccessToken | null {
  return readStore().tokens.find((t) => t.token === value) ?? null
}

export function markTokenUsed(value: string): void {
  mutate((s) => ({
    ...s,
    tokens: s.tokens.map((t) => (t.token === value ? { ...t, usedAt: new Date().toISOString() } : t)),
  }))
}

/* -------------------------------------------------------------------------- */
/* Intakes / questionnaires / responses                                        */
/* -------------------------------------------------------------------------- */

export function listIntakes(): PatientIntake[] {
  return readStore().intakes
}

export function upsertIntake(intake: PatientIntake): void {
  mutate((s) => ({
    ...s,
    intakes: [...s.intakes.filter((i) => i.id !== intake.id), intake],
  }))
}

export function findIntakeByToken(token: string): PatientIntake | null {
  return readStore().intakes.find((i) => i.token === token) ?? null
}

export function listQuestionnaires(): ProgressQuestionnaire[] {
  return readStore().questionnaires
}

export function upsertQuestionnaire(q: ProgressQuestionnaire): void {
  mutate((s) => ({
    ...s,
    questionnaires: [...s.questionnaires.filter((x) => x.id !== q.id), q],
  }))
}

export function findQuestionnaire(id: string): ProgressQuestionnaire | null {
  return readStore().questionnaires.find((q) => q.id === id) ?? null
}

export function listResponses(): PatientResponse[] {
  return readStore().responses
}

export function addResponse(response: PatientResponse): void {
  mutate((s) => ({ ...s, responses: [...s.responses, response] }))
}

export function markResponseHandled(id: string): void {
  mutate((s) => ({
    ...s,
    responses: s.responses.map((r) => (r.id === id ? { ...r, handled: true } : r)),
  }))
}

/* -------------------------------------------------------------------------- */
/* Watchers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Read the no-show watermark, setting it to `now` the first time. Anything
 * that ended before this instant is out of scope for auto-marking.
 */
export function ensureNoShowWatermark(now: Date = new Date()): string {
  const current = readStore().noShowWatermark
  if (current) return current
  const stamp = now.toISOString()
  mutate((s) => ({ ...s, noShowWatermark: stamp }))
  return stamp
}

export function isQuestionnaireFiled(id: string): boolean {
  return (readStore().filedQuestionnaires ?? []).includes(id)
}

export function markQuestionnaireFiled(id: string): void {
  mutate((s) => ({
    ...s,
    filedQuestionnaires: [...new Set([...(s.filedQuestionnaires ?? []), id])],
  }))
}

/** Wipe the queue — used by the Settings "reset simulation" control. */
export function clearStore(): void {
  writeStore(emptyStore())
}
