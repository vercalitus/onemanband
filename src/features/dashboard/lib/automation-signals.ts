import { listIntakes, listOutbox, listResponses } from "@/features/automations/lib/automation-store"
import type { OutboxMessage, PatientIntake, PatientResponse } from "@/types/automation"
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

/** Local first, then remote, one per id — the same event can be in both. */
function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of [...local, ...remote]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

/**
 * @param remoteResponses Taps that happened on a patient's own device, fetched
 * from the database. They are merged rather than replacing the local ones,
 * because in mock mode both sources are real and neither is complete.
 * @param remoteIntakes Self-registrations from the database — written on the
 * patient's phone, which the local store never saw.
 * @param remoteFailures Sends the cron could not make, from the server queue —
 * the only queue the cron touches.
 */
export function deriveAutomationTodos(
  remoteResponses: PatientResponse[] = [],
  remoteIntakes: PatientIntake[] = [],
  remoteFailures: OutboxMessage[] = [],
): TodoItem[] {
  const items: TodoItem[] = []

  /*
   * Failed sends first, and unconditionally.
   *
   * The engine sends on its own, so a WhatsApp that never left is invisible
   * everywhere else in the product — the patient simply doesn't turn up and
   * nobody knows why. This is the one signal that reports the software
   * failing rather than the clinic having work to do.
   */
  const failures = mergeById(
    listOutbox().filter((m) => m.status === "failed"),
    remoteFailures,
  )
  for (const message of failures) {
    if (message.status !== "failed") continue
    items.push({
      id: `rx-sendfail-${message.id}`,
      kind: "reactive",
      priority: "high",
      tone: "fault",
      titleKey: "signal.sendFailed",
      dueKey: "signal.due.sendFailed",
      params: {
        patient: message.patientName || message.to,
        channel: message.channel,
        error: message.error ?? "",
      },
      title: `Message failed to send — ${message.patientName || message.to}`,
      due: message.error ?? "Send failed",
      completed: false,
      // The queue and the channel settings are both here; a failed send is
      // almost always one of the two, and neither is on the dashboard.
      action: {
        kind: "link",
        labelKey: "signal.action.openSettings",
        href: "/settings",
      },
    })
  }

  // Deduplicated by id so a response that is both mirrored and local — which
  // happens whenever the practitioner answers on the same machine that planned
  // the message — produces one task, not two.
  const responses = [...listResponses(), ...remoteResponses]
  const seen = new Set<string>()

  for (const response of responses) {
    if (response.handled) continue
    if (seen.has(response.id)) continue
    seen.add(response.id)

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
        action: {
          kind: "schedule",
          labelKey: "signal.action.book",
          patientId: response.patientId,
          patientName: response.patientName,
        },
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
        // The calendar, not the chart: what needs checking is whether the new
        // slot works against the rest of the day.
        action: {
          kind: "link",
          labelKey: "signal.action.openCalendar",
          href: "/calendar",
        },
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
        action: {
          kind: "link",
          labelKey: "signal.action.openChart",
          href: `/patients/${response.patientId}`,
        },
      })
    }

    /*
     * A patient wrote something, and it outranks everything else here.
     *
     * The clinic asked for it — "message me here directly if anything feels
     * sore" — and nothing in this system can judge whether the words are
     * small talk or a person describing sharp pain. So the message is carried
     * verbatim into the task rather than summarised into a category, and it
     * stays open until someone has actually read it.
     */
    if (response.kind === "message") {
      items.push({
        id: `rx-message-${response.id}`,
        kind: "reactive",
        priority: "high",
        overdue: true,
        titleKey: "signal.patientMessage",
        dueKey: "signal.due.readIt",
        params: {
          patient: response.patientName || response.fromAddress || "—",
          message: response.body ?? "",
        },
        title: `Message from ${response.patientName || response.fromAddress || "a patient"}`,
        due: response.body ?? "Needs reading",
        completed: false,
        // Only when the sender was matched to a patient. An unmatched number
        // has no chart to open, and a button that lands nowhere is worse than
        // no button.
        action: response.patientId
          ? {
              kind: "link" as const,
              labelKey: "signal.action.openChart",
              href: `/patients/${response.patientId}`,
            }
          : undefined,
      })
    }

    // High priority, and deliberately so: money the patient believes has
    // changed hands is sitting without a receipt, and only the practitioner can
    // check the account and close it. Nothing else in the system can.
    if (response.kind === "payment_claimed") {
      items.push({
        id: `rx-paymentclaim-${response.id}`,
        kind: "reactive",
        priority: "high",
        titleKey: "signal.paymentClaimed",
        dueKey: "signal.due.verifyPayment",
        params: { patient: response.patientName },
        title: `Says they've paid — ${response.patientName}`,
        due: "Verify, then issue the receipt",
        completed: false,
        action: {
          kind: "link",
          labelKey: "signal.action.collect",
          href: response.invoiceId ? `/finances?settle=${response.invoiceId}` : "/finances",
        },
      })
    }
  }

  // A submitted intake is a person waiting on the clinic, so it outranks
  // everything except an outright cancellation.
  for (const intake of mergeById(listIntakes(), remoteIntakes)) {
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
      // The new-patient form, already filled in with what the patient wrote.
      // It used to send the practitioner to the patient list to retype it.
      action: {
        kind: "intake",
        labelKey: "signal.action.reviewIntake",
        intakeId: intake.id,
        prefill: {
          fullName: intake.fullName,
          phone: intake.phone,
          email: intake.email,
          dateOfBirth: intake.dateOfBirth,
          complaint: intake.reason,
        },
      },
    })
  }

  // Uncapped on purpose: the board caps and paginates the combined list, and
  // truncating here would silently drop a send failure behind a reschedule.
  return items
}
