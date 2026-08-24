import { listIntakes, listResponses } from "@/features/automations/lib/automation-store"
import type { TodoItem } from "@/types/domain"

/**
 * Reactive signals produced by patient self-service.
 *
 * Split from `reactive-signals.ts` because the source differs in kind: those
 * are derived from clinic data the practitioner already owns, these are things
 * a patient *did* — cancelled, moved a slot, registered, returned a
 * questionnaire — and each one is a handover that needs acknowledging.
 *
 * Read from the automation store, which is browser-only in mock mode, so this
 * must run after mount (see TodosProvider) or SSR and the client disagree.
 */

/** Kept small: this list rides on top of the derived clinic signals. */
const MAX_ITEMS = 4

export function deriveAutomationTodos(): TodoItem[] {
  const items: TodoItem[] = []

  for (const response of listResponses()) {
    if (response.handled) continue

    if (response.kind === "cancelled") {
      items.push({
        id: `rx-patientcancel-${response.id}`,
        kind: "reactive",
        priority: "high",
        overdue: true,
        titleKey: "signal.patientCancelled",
        dueKey: "signal.due.justNow",
        params: { patient: response.patientName },
        title: `Patient cancelled — ${response.patientName}`,
        due: "Needs rebooking",
        completed: false,
      })
    }

    if (response.kind === "rescheduled") {
      items.push({
        id: `rx-patientmove-${response.id}`,
        kind: "reactive",
        priority: "medium",
        titleKey: "signal.patientRescheduled",
        dueKey: "signal.due.newSlot",
        params: {
          patient: response.patientName,
          date: response.newDate ?? "",
          time: response.newStart ?? "",
        },
        title: `Patient moved their appointment — ${response.patientName}`,
        due: `${response.newDate ?? ""} ${response.newStart ?? ""}`.trim(),
        completed: false,
      })
    }

    if (response.kind === "questionnaire") {
      items.push({
        id: `rx-questionnaire-${response.id}`,
        kind: "reactive",
        priority: "medium",
        titleKey: "signal.questionnaireReturned",
        dueKey: "signal.due.inFile",
        params: { patient: response.patientName },
        title: `Progress questionnaire returned — ${response.patientName}`,
        due: "Filed under Progress",
        completed: false,
      })
    }
  }

  // A submitted intake is a person waiting on the clinic, so it outranks
  // everything except an outright cancellation.
  for (const intake of listIntakes()) {
    if (intake.status !== "submitted") continue
    items.push({
      // Not `rx-intake-*`: that prefix already means "prep for a first visit"
      // in reactive-signals.ts, and the per-type cap keys off it.
      id: `rx-newpatient-${intake.id}`,
      kind: "reactive",
      priority: "high",
      titleKey: "signal.newIntake",
      dueKey: "signal.due.requested",
      params: {
        patient: intake.fullName,
        date: intake.requestedDate ?? "",
        time: intake.requestedStart ?? "",
      },
      title: `Approve new patient registration — ${intake.fullName}`,
      due: `${intake.requestedDate ?? ""} ${intake.requestedStart ?? ""}`.trim(),
      completed: false,
    })
  }

  return items.slice(0, MAX_ITEMS)
}
