import { patients, todaySchedule, weeklySchedule } from "@/lib/mock-data"
import { seedIntegration, seedInvoices, seedUninvoicedVisits } from "@/lib/mock-finances"
import type { ScheduleItem, TodoItem } from "@/types/domain"

/**
 * Reactive-signal engine.
 *
 * Scans the clinic's live data (invoices, appointments, patients, billing
 * integration) and surfaces the things the clinician should act on — the
 * "Reactive" column of the dashboard to-do board. Everything here is derived,
 * never hand-authored: change the underlying data and the list changes.
 *
 * Titles are emitted as i18n keys + params so the UI can localize them; the
 * plain `title`/`due` strings are English fallbacks. Ids are stable (keyed off
 * the source record) so completion state survives re-derivation.
 *
 * Mock-only today — swaps for real Supabase reads later, same output shape.
 */

const MS_PER_DAY = 86_400_000

/** How stale an active patient's last visit must be to nudge a follow-up. */
const FOLLOW_UP_DAYS = 60
/** An issued invoice this close to its due date is flagged. */
const DUE_SOON_DAYS = 3
/** Billing sync older than this is considered stale. */
const SYNC_STALE_HOURS = 24
/**
 * Upper bound on derived signals.
 *
 * Readability is no longer this function's job — the board shows five and
 * folds the rest behind a stated count, so truncating here would hide items
 * the UI is already prepared to page through. This cap only exists to stop a
 * pathological dataset producing hundreds of rows.
 */
const MAX_ITEMS = 12
/** Cap per signal type so one noisy type can't crowd out the rest. */
const PER_TYPE_CAP = 2

/** Signal family, taken from the id prefix (`rx-<type>-<ref>`). */
const typeOf = (id: string) => id.split("-")[1] ?? id

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const isoDay = (d: Date) => startOfDay(d).toISOString().slice(0, 10)
const daysBetween = (fromIso: string, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(new Date(fromIso)).getTime()) / MS_PER_DAY)

const PRIORITY_RANK: Record<TodoItem["priority"], number> = { high: 0, medium: 1, low: 2 }

/**
 * Build the reactive to-do list from current clinic data.
 * `now` is injectable for testing; defaults to the real clock.
 */
/**
 * @param schedule The clinic's real diary once it has one. Defaults to the mock
 * seed, which is what the demo runs on — a signal about a fictional visit next
 * to a real one would be worse than no signal at all.
 */
export function deriveReactiveTodos(
  now: Date = new Date(),
  schedule?: ScheduleItem[],
): TodoItem[] {
  const items: TodoItem[] = []
  const tomorrowIso = isoDay(new Date(now.getTime() + MS_PER_DAY))
  const appointments = schedule ?? [...todaySchedule, ...weeklySchedule]

  // 1 — Overdue invoices: money already past due.
  for (const inv of seedInvoices.filter((i) => i.status === "overdue")) {
    items.push({
      id: `rx-overdue-${inv.id}`,
      kind: "reactive",
      priority: "high",
      overdue: true,
      titleKey: "signal.overdueInvoice",
      dueKey: "signal.due.daysOverdue",
      params: {
        patient: inv.patientName,
        amount: inv.displayAmount,
        days: inv.dueAt ? Math.abs(daysBetween(inv.dueAt, now)) : 0,
      },
      title: `Chase overdue payment — ${inv.patientName} · ${inv.displayAmount}`,
      due: "Overdue",
      completed: false,
    })
  }

  // 2 — Invoices coming due within the next few days.
  for (const inv of seedInvoices.filter((i) => i.status === "issued" && i.dueAt)) {
    const inDays = daysBetween(now.toISOString(), new Date(inv.dueAt as string))
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

  // 3 — Completed visits that were never invoiced.
  for (const visit of seedUninvoicedVisits) {
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

  // 4 & 6 — Tomorrow's appointments: confirm the unconfirmed, prep first visits.
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

  // 5 — No-shows waiting to be rescheduled.
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

  // 7 & 8 — Patient relationship signals: overdue follow-up, frozen re-engage.
  for (const patient of patients) {
    if (patient.status === "active") {
      const days = daysBetween(patient.lastVisit, now)
      if (days >= FOLLOW_UP_DAYS) {
        items.push({
          id: `rx-followup-${patient.id}`,
          kind: "reactive",
          priority: "medium",
          titleKey: "signal.followUp",
          dueKey: "signal.due.sinceVisit",
          params: { patient: patient.fullName, weeks: Math.floor(days / 7) },
          title: `Follow up — ${patient.fullName} (${Math.floor(days / 7)}w since last visit)`,
          due: `Last visit ${patient.lastVisit}`,
          completed: false,
        })
      }
    } else if (patient.status === "frozen") {
      items.push({
        id: `rx-frozen-${patient.id}`,
        kind: "reactive",
        priority: "low",
        titleKey: "signal.reengageFrozen",
        dueKey: "signal.due.frozen",
        params: { patient: patient.fullName },
        title: `Re-engage frozen patient — ${patient.fullName}`,
        due: "On hold",
        completed: false,
      })
    }
  }

  // 9 — Invoices that failed to sync to the billing provider.
  for (const inv of seedInvoices.filter((i) => i.syncStatus === "failed")) {
    items.push({
      id: `rx-syncfail-${inv.id}`,
      kind: "reactive",
      priority: "high",
      titleKey: "signal.syncFailed",
      dueKey: "signal.due.syncFailed",
      params: { patient: inv.patientName, provider: inv.provider },
      title: `Retry failed billing sync — ${inv.patientName}`,
      due: "Sync failed",
      completed: false,
    })
  }

  // 10 — Billing provider disconnected or its last sync went stale.
  const syncAgeHours = (now.getTime() - new Date(seedIntegration.lastSyncAt).getTime()) / 3_600_000
  if (!seedIntegration.connected || syncAgeHours > SYNC_STALE_HOURS) {
    items.push({
      id: `rx-provider-${seedIntegration.provider}`,
      kind: "reactive",
      priority: "medium",
      titleKey: seedIntegration.connected ? "signal.syncStale" : "signal.providerDisconnected",
      dueKey: "signal.due.provider",
      params: { provider: seedIntegration.provider },
      title: seedIntegration.connected
        ? `Billing sync is stale — ${seedIntegration.provider}`
        : `Reconnect billing provider — ${seedIntegration.provider}`,
      due: seedIntegration.connected ? "Sync stale" : "Disconnected",
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
