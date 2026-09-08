import type {
  BillingInvoice,
  PatientSummary,
  ScheduleItem,
  TodoItem,
  UninvoicedVisit,
} from "@/types/domain"

/**
 * Reactive-signal engine.
 *
 * The "needs attention" column of the dashboard. Everything here is *derived* —
 * nobody types these tasks in, and none of them can be marked done in a way
 * that outlives the condition. Fix the thing and the row goes; leave it and the
 * row comes back tomorrow. That is the whole design: a to-do list that can go
 * stale is worse than none, because the practitioner stops trusting it.
 *
 * A signal earns its place by passing three tests:
 *
 *  1. **It is true.** Derived from a record, never a guess about what a
 *     practitioner might want to do.
 *  2. **Somebody has to act.** If the system can handle it, the system should
 *     handle it — a reminder that sends itself does not belong on this board.
 *  3. **It ends.** A permanent state is not a signal. "Patient is frozen" was
 *     on this board and never resolved, because being frozen is not an event
 *     and there was nothing to do about it.
 *
 * Titles are i18n keys plus params; `title`/`due` are English fallbacks. Ids
 * are keyed off the source record so dismissal survives re-derivation.
 */

const MS_PER_DAY = 86_400_000

/**
 * How long an unpaid visit may sit before it is worth chasing.
 *
 * The clinic bills cash-basis: most people pay at the session, so an unpaid row
 * a week later is not a slow payer, it is a visit somebody forgot to settle.
 */
const UNPAID_CHASE_DAYS = 7
/** An issued invoice this close to its due date is flagged. */
const DUE_SOON_DAYS = 3
/** A patient part-way through an agreed plan who has not been in for this long. */
const PLAN_STALLED_DAYS = 21
/** How stale an active patient's last visit must be to nudge a follow-up. */
const FOLLOW_UP_DAYS = 60
/**
 * And how stale is too stale.
 *
 * Past a year this is not a follow-up, it is a lead nobody is going to call —
 * and with 1,178 imported patients an unbounded rule would bury the board under
 * people last seen in 2023.
 */
const FOLLOW_UP_LIMIT_DAYS = 365
/** A visit this soon that the clinic has no way to send a reminder for. */
const UNREACHABLE_WINDOW_DAYS = 7

/**
 * Upper bound on derived signals.
 *
 * The board shows five and folds the rest behind a stated count, so this only
 * exists to stop a pathological dataset producing hundreds of rows.
 */
const MAX_ITEMS = 12
/** Cap per signal type so one noisy type can't crowd out the rest. */
const PER_TYPE_CAP = 2

/** Signal family, taken from the id prefix (`rx-<type>-<ref>`). */
const typeOf = (id: string) => id.split("-")[1] ?? id

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const isoDay = (d: Date) => {
  const s = startOfDay(d)
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`
}
const daysBetween = (fromIso: string, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(new Date(fromIso)).getTime()) / MS_PER_DAY)

const PRIORITY_RANK: Record<TodoItem["priority"], number> = { high: 0, medium: 1, low: 2 }

const OPEN_APPOINTMENT = new Set(["scheduled", "confirmed", "uncertain"])

/**
 * What the engine reads. Passed in rather than imported so there is one place —
 * the provider — that decides whether this is the clinic's data or the demo's,
 * and no signal can quietly source itself from somewhere else.
 */
export interface ClinicSignalInput {
  now?: Date
  appointments: ScheduleItem[]
  invoices: BillingInvoice[]
  /** Completed visits with no invoice against them. */
  uninvoicedVisits: UninvoicedVisit[]
  patients: PatientSummary[]
  /** Sessions recorded per patient, for care-plan progress. */
  treatmentCounts: Map<string, number>
  /** Result of the last billing-provider check, when one has been made. */
  billing?: { ok: boolean; provider: string; message?: string } | null
}

export function deriveReactiveTodos(input: ClinicSignalInput): TodoItem[] {
  const now = input.now ?? new Date()
  const items: TodoItem[] = []
  const tomorrowIso = isoDay(new Date(now.getTime() + MS_PER_DAY))
  const { appointments, invoices, uninvoicedVisits, patients, treatmentCounts } = input

  /** Patients with something in the diary ahead of them. */
  const booked = new Set(
    appointments
      .filter((a) => OPEN_APPOINTMENT.has(a.status) && a.date >= isoDay(now))
      .map((a) => a.patientId),
  )

  /* ── Money ─────────────────────────────────────────────────────────────── */

  // 1 — A visit happened and nothing was charged for it. First, because it is
  // the only one where the money has not been asked for at all.
  for (const visit of uninvoicedVisits) {
    items.push({
      id: `rx-uninvoiced-${visit.id}`,
      kind: "reactive",
      priority: "medium",
      titleKey: "signal.uninvoicedVisit",
      dueKey: "signal.due.visitOn",
      params: {
        patient: visit.patientName,
        amount: visit.suggestedDisplayAmount,
        date: visit.visitDate,
      },
      title: `Generate invoice for completed visit — ${visit.patientName}`,
      due: `Visit ${visit.visitDate}`,
      completed: false,
    })
  }

  /*
   * 2 & 3 — Unpaid invoices.
   *
   * A due date is used when the invoice has one. When it does not — and most
   * will not, because the clinic charges at the session and only writes a row
   * down when somebody did not pay — the invoice is chased once it has sat for
   * a week. That is the difference between a payment term and a visit that got
   * forgotten, and only the second one needs a person.
   */
  const unpaid = invoices.filter(
    (inv) =>
      inv.paymentStatus !== "paid" &&
      inv.paymentStatus !== "refunded" &&
      inv.status !== "void" &&
      inv.status !== "draft",
  )

  const overdue = unpaid
    .map((inv) => {
      const dueDays = inv.dueAt ? daysBetween(inv.dueAt, now) : null
      const ageDays = inv.issuedAt ? daysBetween(inv.issuedAt, now) : null
      if (dueDays !== null && dueDays > 0) return { inv, days: dueDays }
      if (dueDays === null && ageDays !== null && ageDays >= UNPAID_CHASE_DAYS) {
        return { inv, days: ageDays }
      }
      return null
    })
    .filter((x): x is { inv: BillingInvoice; days: number } => x !== null)
    // Longest outstanding first: the per-type cap means only the top two are
    // shown, and they should be the two that have waited longest.
    .sort((a, b) => b.days - a.days)

  for (const { inv, days } of overdue) {
    items.push({
      id: `rx-overdue-${inv.id}`,
      kind: "reactive",
      priority: "high",
      overdue: true,
      titleKey: "signal.overdueInvoice",
      dueKey: "signal.due.daysOverdue",
      params: { patient: inv.patientName, amount: inv.displayAmount, days },
      title: `Chase overdue payment — ${inv.patientName} · ${inv.displayAmount}`,
      due: "Overdue",
      completed: false,
    })
  }

  for (const inv of unpaid) {
    if (!inv.dueAt) continue
    const inDays = -daysBetween(inv.dueAt, now)
    if (inDays < 0 || inDays > DUE_SOON_DAYS) continue
    items.push({
      id: `rx-duesoon-${inv.id}`,
      kind: "reactive",
      priority: "medium",
      titleKey: "signal.invoiceDueSoon",
      dueKey: "signal.due.inDays",
      params: { patient: inv.patientName, amount: inv.displayAmount, days: inDays },
      title: `Invoice due soon — ${inv.patientName} · ${inv.displayAmount}`,
      due: `In ${inDays}d`,
      completed: false,
    })
  }

  /*
   * 4 — Paid, but no tax document was filed.
   *
   * A fault rather than a job: money has changed hands and the receipt that
   * legally has to exist does not. Nothing else in the product would ever
   * mention it, and the practitioner is the only one who can put it right.
   */
  for (const inv of invoices) {
    if (inv.syncStatus !== "failed") continue
    items.push({
      id: `rx-syncfail-${inv.id}`,
      kind: "reactive",
      priority: "high",
      tone: "fault",
      titleKey: "signal.syncFailed",
      dueKey: "signal.due.syncFailed",
      params: { patient: inv.patientName, provider: inv.provider },
      title: `Retry failed billing sync — ${inv.patientName}`,
      due: "Sync failed",
      completed: false,
    })
  }

  /* ── The diary ─────────────────────────────────────────────────────────── */

  for (const appt of appointments.filter((a) => a.date === tomorrowIso)) {
    if (appt.status === "scheduled") {
      items.push({
        id: `rx-confirm-${appt.id}`,
        kind: "reactive",
        priority: "high",
        titleKey: "signal.confirmTomorrow",
        dueKey: "signal.due.tomorrowAt",
        params: { patient: appt.patientName, time: appt.start },
        title: `Confirm tomorrow's appointment — ${appt.patientName} ${appt.start}`,
        due: `Tomorrow ${appt.start}`,
        completed: false,
      })
    }
    if (appt.appointmentType === "first") {
      items.push({
        id: `rx-intake-${appt.id}`,
        kind: "reactive",
        priority: "medium",
        titleKey: "signal.firstVisitPrep",
        dueKey: "signal.due.tomorrowAt",
        params: { patient: appt.patientName, time: appt.start },
        title: `Prep intake for first visit — ${appt.patientName}`,
        due: `Tomorrow ${appt.start}`,
        completed: false,
      })
    }
  }

  for (const appt of appointments.filter((a) => a.status === "no_show")) {
    items.push({
      id: `rx-noshow-${appt.id}`,
      kind: "reactive",
      priority: "medium",
      titleKey: "signal.rescheduleNoShow",
      dueKey: "signal.due.missedOn",
      params: { patient: appt.patientName, date: appt.date },
      title: `Reschedule no-show — ${appt.patientName}`,
      due: `Missed ${appt.date}`,
      completed: false,
    })
  }

  /*
   * 5 — A visit the clinic cannot send a reminder for.
   *
   * Narrow on purpose. Most of this clinic's imported patients have no phone
   * number and listing them all would be a report, not a task. Someone who is
   * coming in this week is different: there is a person to ask, a reason to
   * ask, and a date by which asking stops being useful.
   */
  const contactable = new Map(patients.map((p) => [p.id, !!(p.phone || p.email)]))
  const reachableBy = isoDay(new Date(now.getTime() + UNREACHABLE_WINDOW_DAYS * MS_PER_DAY))
  for (const appt of appointments) {
    if (!OPEN_APPOINTMENT.has(appt.status)) continue
    if (appt.date < isoDay(now) || appt.date > reachableBy) continue
    if (contactable.get(appt.patientId) !== false) continue
    items.push({
      id: `rx-unreachable-${appt.patientId}`,
      kind: "reactive",
      priority: "medium",
      titleKey: "signal.noContactDetails",
      dueKey: "signal.due.visitOnDate",
      params: { patient: appt.patientName, date: appt.date },
      title: `No way to reach ${appt.patientName} — visit ${appt.date}`,
      due: `Visit ${appt.date}`,
      completed: false,
    })
  }

  /* ── Care plans ────────────────────────────────────────────────────────── */

  for (const patient of patients) {
    const target = patient.carePlanSessions
    if (!target) continue
    const done = treatmentCounts.get(patient.id) ?? 0

    // 6 — The agreed course is finished. A decision is owed: another block, or
    // discharge. Left alone, a completed plan quietly becomes an open-ended one.
    if (done >= target) {
      items.push({
        id: `rx-plandone-${patient.id}`,
        kind: "reactive",
        priority: "medium",
        titleKey: "signal.carePlanComplete",
        dueKey: "signal.due.sessionsDone",
        params: { patient: patient.fullName, done, total: target },
        title: `Care plan complete — ${patient.fullName} (${done}/${target})`,
        due: `${done}/${target} sessions`,
        completed: false,
      })
      continue
    }

    // 7 — Part-way through a plan and not seen for weeks. Stronger than a
    // general follow-up: this patient agreed to a course of treatment and has
    // stopped mid-way, which is the point at which people quietly drop out.
    if (!patient.lastVisit || booked.has(patient.id)) continue
    const days = daysBetween(patient.lastVisit, now)
    if (days < PLAN_STALLED_DAYS || days > FOLLOW_UP_LIMIT_DAYS) continue
    items.push({
      id: `rx-planstalled-${patient.id}`,
      kind: "reactive",
      priority: "medium",
      titleKey: "signal.carePlanStalled",
      dueKey: "signal.due.sinceVisit",
      params: { patient: patient.fullName, done, total: target, weeks: Math.floor(days / 7) },
      title: `Care plan stalled — ${patient.fullName} (${done}/${target})`,
      due: `Last visit ${patient.lastVisit}`,
      completed: false,
    })
  }

  /* ── The long tail ─────────────────────────────────────────────────────── */

  // 8 — An active patient who has not been in for a while and has nothing
  // booked. Bounded at both ends, and skipped entirely for anyone already in
  // the diary: a patient coming on Thursday does not need chasing.
  const followUps = patients
    .filter((p) => p.status === "active" && p.lastVisit && !booked.has(p.id))
    .map((p) => ({ p, days: daysBetween(p.lastVisit, now) }))
    .filter(({ days }) => days >= FOLLOW_UP_DAYS && days <= FOLLOW_UP_LIMIT_DAYS)
    // Most recently lapsed first — they are the ones still worth a call.
    .sort((a, b) => a.days - b.days)

  for (const { p, days } of followUps) {
    items.push({
      id: `rx-followup-${p.id}`,
      kind: "reactive",
      priority: "low",
      titleKey: "signal.followUp",
      dueKey: "signal.due.sinceVisit",
      params: { patient: p.fullName, weeks: Math.floor(days / 7) },
      title: `Follow up — ${p.fullName} (${Math.floor(days / 7)}w since last visit)`,
      due: `Last visit ${p.lastVisit}`,
      completed: false,
    })
  }

  /* ── The system itself ─────────────────────────────────────────────────── */

  // 9 — Billing cannot file a document. Worth saying out loud before somebody
  // takes payment and finds out afterwards that no receipt exists.
  if (input.billing && !input.billing.ok) {
    items.push({
      id: `rx-provider-${input.billing.provider}`,
      kind: "reactive",
      priority: "high",
      tone: "fault",
      titleKey: "signal.providerDisconnected",
      dueKey: "signal.due.provider",
      params: { provider: input.billing.provider },
      title: `Reconnect billing provider — ${input.billing.provider}`,
      due: "Disconnected",
      completed: false,
    })
  }

  // Most urgent first, then cap per type (so a noisy type can't crowd out the
  // rest) and cap the total so the board never floods.
  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
  const perType = new Map<string, number>()
  const diverse: TodoItem[] = []
  for (const item of items) {
    const ty = typeOf(item.id)
    const seen = perType.get(ty) ?? 0
    if (seen >= PER_TYPE_CAP) continue
    perType.set(ty, seen + 1)
    diverse.push(item)
    if (diverse.length >= MAX_ITEMS) break
  }
  return diverse
}
