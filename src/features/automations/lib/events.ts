import {
  addResponse,
  cancelPendingForAppointment as cancelLocalForAppointment,
  cancelPendingForInvoice as cancelLocalForInvoice,
  enqueueMessages,
  listResponses,
  markResponseHandled,
  randomId,
} from "@/features/automations/lib/automation-store"
import { setAppointmentOverlay } from "@/features/automations/lib/appointment-overlay"
import { planMessages, type AutomationEvent, type PlanContext } from "@/features/automations/lib/plan-messages"
import { createQuestionnaire } from "@/features/automations/lib/questionnaire"
import type { ClinicSettings } from "@/types/clinic-settings"
import type {
  MessageChannel,
  OutboxMessage,
  PatientResponse,
  PatientResponseKind,
} from "@/types/automation"

/**
 * Everything the rest of the app calls to drive automations.
 *
 * Feature code should never touch the planner, the store or the dispatcher
 * directly — it emits a business fact ("this visit is done") and this module
 * turns it into queued messages. That keeps the automation rules in one place
 * instead of smeared across the calendar, finances and patient screens.
 */

/** Fold ClinicSettings into the shape the planner wants. */
export function planContextFromSettings(
  settings: ClinicSettings,
  options: { origin?: string; locale?: string; now?: Date } = {},
): PlanContext {
  const { notifications } = settings
  const channelEnabled: Record<MessageChannel, boolean> = {
    whatsapp: notifications.whatsappEnabled,
    email: notifications.emailEnabled,
    sms: notifications.smsEnabled,
  }
  return {
    automations: settings.automations,
    clinicName: settings.profile.clinicName,
    practitionerName: settings.profile.practitionerName || undefined,
    channelEnabled,
    origin: options.origin,
    locale: options.locale,
    now: options.now,
  }
}

/** Plan + queue in one step. Returns only what was newly queued. */
function emit(event: AutomationEvent, ctx: PlanContext): OutboxMessage[] {
  const queued = enqueueMessages(planMessages(event, ctx))
  mirrorQueued(queued)
  return queued
}

/**
 * Copy what was just queued to the server, where the cron can reach it.
 *
 * Fire and forget, and only the newly added messages: `enqueueMessages` has
 * already dropped anything it had seen before, and the database has a unique
 * index for the case where two tabs plan the same event at once. A failure
 * here leaves the message queued locally exactly as it was, which is the
 * behaviour this had before the server queue existed.
 */
function mirrorQueued(messages: OutboxMessage[]): void {
  if (!messages.length || typeof window === "undefined") return
  void fetch("/api/automations/outbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  }).catch(() => {})
}

/**
 * Cancelling has to reach the server for the same reason queueing does, and
 * more urgently: an un-mirrored cancel means the cron cheerfully sends "see
 * you in an hour" to someone who cancelled this morning. Wrapping both calls
 * together is what keeps the two copies from drifting.
 */
function cancelPendingForAppointment(appointmentId: string): number {
  const count = cancelLocalForAppointment(appointmentId)
  mirrorCancel({ appointmentId })
  return count
}

function cancelPendingForInvoice(invoiceId: string): number {
  const count = cancelLocalForInvoice(invoiceId)
  mirrorCancel({ invoiceId })
  return count
}

function mirrorCancel(target: { appointmentId?: string; invoiceId?: string }): void {
  if (typeof window === "undefined") return
  void fetch("/api/automations/outbox", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  }).catch(() => {})
}

/* -------------------------------------------------------------------------- */
/* Appointment lifecycle                                                       */
/* -------------------------------------------------------------------------- */

export interface AppointmentEventInput {
  patientId: string
  patientName: string
  phone?: string
  email?: string
  appointmentId: string
  appointmentDate: string
  appointmentStart: string
  appointmentEnd: string
}

/**
 * A visit was booked — by the clinic or by the patient themselves.
 * Fires the confirmation and lays down the whole reminder ladder at once, so
 * a single tick loop can deliver them without re-planning.
 */
export function onAppointmentBooked(
  input: AppointmentEventInput,
  ctx: PlanContext,
): OutboxMessage[] {
  return [
    ...emit({ ...input, trigger: "appointment.booked" }, ctx),
    ...emit({ ...input, trigger: "appointment.reminder" }, ctx),
  ]
}

/**
 * A visit moved. The old ladder is cancelled before the new one is planned —
 * without this a rescheduled patient receives both.
 */
export function onAppointmentRescheduled(
  input: AppointmentEventInput,
  ctx: PlanContext,
): OutboxMessage[] {
  cancelPendingForAppointment(input.appointmentId)
  return onAppointmentBooked(input, ctx)
}

/** A visit was cancelled — drop everything still queued for it. */
export function onAppointmentCancelled(appointmentId: string): number {
  return cancelPendingForAppointment(appointmentId)
}

/**
 * The session finished. Triggers the post-treatment sequence, and every Nth
 * session also opens a progress questionnaire.
 */
export function onTreatmentCompleted(
  input: AppointmentEventInput & {
    invoiceId?: string
    invoiceAmount?: string
    invoiceIssuedDate?: string
    completedSessions?: number
  },
  ctx: PlanContext,
): OutboxMessage[] {
  const queued = emit({ ...input, trigger: "treatment.completed" }, ctx)

  const every = ctx.automations.progressQuestionnaireEverySessions
  const sessions = input.completedSessions
  if (every > 0 && sessions && sessions % every === 0) {
    // The questionnaire row must exist before the message is planned — the
    // planner mints a token pointing at it, and a token referencing nothing
    // gives the patient a dead link.
    const questionnaire = createQuestionnaire(input.patientId, input.patientName, sessions)
    queued.push(
      ...emit(
        {
          ...input,
          trigger: "progress.checkpoint",
          sessionNumber: sessions,
          questionnaireId: questionnaire.id,
        },
        ctx,
      ),
    )
  }

  return queued
}

/**
 * The patient never turned up and never said so. Called after
 * `noShowGraceMinutes` has elapsed past the slot end.
 */
export function onNoShow(
  input: AppointmentEventInput & {
    invoiceId?: string
    invoiceAmount?: string
    invoiceIssuedDate?: string
  },
  ctx: PlanContext,
): OutboxMessage[] {
  cancelPendingForAppointment(input.appointmentId)
  return emit(
    {
      ...input,
      trigger: "appointment.no_show",
      noShowMarkedAt: (ctx.now ?? new Date()).toISOString(),
    },
    ctx,
  )
}

/* -------------------------------------------------------------------------- */
/* Billing                                                                     */
/* -------------------------------------------------------------------------- */

export interface InvoiceEventInput {
  patientId: string
  patientName: string
  phone?: string
  email?: string
  invoiceId: string
  invoiceAmount: string
  /** Clinic-local ISO date the invoice was issued. */
  invoiceIssuedDate: string
}

/** Start the dunning ladder: 24h after issue, then daily until settled. */
export function onInvoiceIssued(input: InvoiceEventInput, ctx: PlanContext): OutboxMessage[] {
  return emit({ ...input, trigger: "invoice.unpaid" }, ctx)
}

/**
 * Payment landed — stop the ladder immediately, and answer any open claim.
 *
 * The practitioner recording the payment is the only thing that can close a
 * `payment_claimed` response: it means a person went and looked. Nothing here
 * expires on a timer, because a claim nobody checked is not a claim resolved.
 */
export function onInvoicePaid(invoiceId: string): number {
  for (const response of listResponses()) {
    if (
      response.kind === "payment_claimed" &&
      response.invoiceId === invoiceId &&
      !response.handled
    ) {
      markResponseHandled(response.id)
    }
  }
  return cancelPendingForInvoice(invoiceId)
}

/* -------------------------------------------------------------------------- */
/* Inbound patient actions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Record something the patient did through a link or a WhatsApp button.
 * Cancellations and reschedules also clear the queue for that visit, and every
 * response except a plain confirmation surfaces on the dashboard as work for
 * the practitioner.
 */
export function recordPatientResponse(input: {
  kind: PatientResponseKind
  patientId: string
  patientName: string
  appointmentId?: string
  questionnaireId?: string
  invoiceId?: string
  newDate?: string
  newStart?: string
}): PatientResponse {
  if (
    (input.kind === "cancelled" || input.kind === "rescheduled") &&
    input.appointmentId
  ) {
    cancelPendingForAppointment(input.appointmentId)
  }

  // A patient who says they have paid stops being chased, even though nothing
  // is settled yet. Continuing to dun someone daily while their claim sits in
  // a queue is the rudest thing this system could do, and the claim is not a
  // way to disappear: it leaves a task that only the practitioner can close.
  if (input.kind === "payment_claimed" && input.invoiceId) {
    cancelPendingForInvoice(input.invoiceId)
  }

  // Write the change through to the schedule. Without this the calendar keeps
  // showing a visit the patient has already cancelled or moved.
  if (input.appointmentId) {
    if (input.kind === "confirmed") {
      setAppointmentOverlay(input.appointmentId, { status: "confirmed" })
    } else if (input.kind === "cancelled") {
      setAppointmentOverlay(input.appointmentId, { status: "cancelled" })
    } else if (input.kind === "rescheduled" && input.newDate && input.newStart) {
      // Status returns to `scheduled`: the patient picked a slot but has not
      // confirmed the new one, and the practitioner still has to accept it.
      setAppointmentOverlay(input.appointmentId, {
        status: "scheduled",
        date: input.newDate,
        start: input.newStart,
      })
    }
  }

  const response: PatientResponse = {
    id: randomId("resp"),
    ...input,
    receivedAt: new Date().toISOString(),
    // A confirmation needs no follow-up; everything else does.
    handled: input.kind === "confirmed",
  }
  addResponse(response)
  return response
}
