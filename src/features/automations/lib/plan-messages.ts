import {
  addIsoDays,
  addMinutes,
  clinicDateTimeToUtc,
  clinicHhmm,
  clinicIsoDate,
  formatClinicDateTime,
} from "@/features/automations/lib/clinic-time"
import { randomId } from "@/features/automations/lib/automation-store"
import { renderTemplate } from "@/features/automations/lib/template-render"
import { mintToken, tokenLink } from "@/features/automations/lib/tokens"
import { allowsChannel } from "@/features/patients/lib/patient-extras-store"
import type {
  AutomationAction,
  AutomationSequence,
  AutomationStep,
  AutomationTrigger,
  ClinicAutomations,
  MessageChannel,
  OutboxMessage,
  QuietHours,
} from "@/types/automation"

/**
 * The automation engine.
 *
 * One entry point: hand it an event plus the clinic's configuration, get back
 * the messages that should exist and when each becomes due. It touches no
 * network, no clock beyond the `now` you pass, and no storage — which is what
 * makes the whole reminder ladder testable without a messaging provider.
 *
 * Persisting the result and eventually delivering it are someone else's job
 * (`automation-store` and `dispatcher` respectively).
 */

export interface AutomationEvent {
  trigger: AutomationTrigger
  patientId: string
  patientName: string
  /** Recipient handles; a step is skipped when its channel has no address. */
  phone?: string
  email?: string
  appointmentId?: string
  /** Clinic-local appointment date `YYYY-MM-DD`. */
  appointmentDate?: string
  /** Clinic-local `HH:mm`. */
  appointmentStart?: string
  appointmentEnd?: string
  invoiceId?: string
  /** Pre-formatted, e.g. "₪250" — the engine never formats currency itself. */
  invoiceAmount?: string
  /** Clinic-local ISO date the invoice was issued. */
  invoiceIssuedDate?: string
  /** Completed-session count behind a progress checkpoint. */
  sessionNumber?: number
  /** Questionnaire the `open_questionnaire` action should land on. */
  questionnaireId?: string
  /** Instant the no-show was marked; defaults to `now`. */
  noShowMarkedAt?: string
}

export interface PlanContext {
  automations: ClinicAutomations
  clinicName: string
  practitionerName?: string
  /** Master channel switches from ClinicNotifications. */
  channelEnabled: Record<MessageChannel, boolean>
  /** Absolute base for links, e.g. "https://onemanband.vercel.app". */
  origin?: string
  /** Locale used only to format {date} / {time} inside message copy. */
  locale?: string
  now?: Date
}

/** Anchor instant for a step's schedule, or null when the event lacks it. */
function anchorInstant(
  step: AutomationStep,
  event: AutomationEvent,
  timezone: string,
  now: Date,
): Date | null {
  const schedule = step.schedule
  if (schedule.mode === "immediate") return now

  switch (schedule.anchor) {
    case "event":
      return now
    case "appointment_start":
      return event.appointmentDate && event.appointmentStart
        ? clinicDateTimeToUtc(timezone, event.appointmentDate, event.appointmentStart)
        : null
    case "appointment_end":
      return event.appointmentDate && event.appointmentEnd
        ? clinicDateTimeToUtc(timezone, event.appointmentDate, event.appointmentEnd)
        : null
    case "no_show_marked":
      return event.noShowMarkedAt ? new Date(event.noShowMarkedAt) : now
    case "invoice_issued":
      return event.invoiceIssuedDate
        ? clinicDateTimeToUtc(timezone, event.invoiceIssuedDate, "00:00")
        : now
    default:
      return null
  }
}

/**
 * Due instants for one step — a list because recurring dunning fans out into
 * several. Empty means the step cannot apply to this event.
 */
function dueInstants(
  step: AutomationStep,
  event: AutomationEvent,
  timezone: string,
  now: Date,
): { at: Date; runIndex?: number }[] {
  const anchor = anchorInstant(step, event, timezone, now)
  if (!anchor) return []

  switch (step.schedule.mode) {
    case "immediate":
      return [{ at: now }]

    case "offset":
      return [{ at: addMinutes(anchor, step.schedule.minutes) }]

    case "clock_before": {
      // "18:00 the evening before" — a wall-clock time on an earlier calendar
      // day, resolved in clinic time so DST cannot shift it by an hour.
      const anchorDay = clinicIsoDate(anchor, timezone)
      const day = addIsoDays(anchorDay, -step.schedule.daysBefore)
      return [{ at: clinicDateTimeToUtc(timezone, day, step.schedule.atTime) }]
    }

    case "recurring": {
      const { firstAfterHours, everyHours, maxRuns } = step.schedule
      const runs: { at: Date; runIndex: number }[] = []
      for (let i = 0; i < maxRuns; i += 1) {
        runs.push({
          at: addMinutes(anchor, (firstAfterHours + i * everyHours) * 60),
          runIndex: i,
        })
      }
      // Queued upfront and cancelled wholesale when the invoice settles
      // (`cancelPendingForInvoice`), so payment always stops the ladder.
      return runs
    }

    default:
      return []
  }
}

/** Which token a set of action buttons needs, if any. */
function tokenKindForActions(actions: AutomationAction[]) {
  if (actions.includes("open_questionnaire")) return "questionnaire" as const
  if (actions.includes("open_invoice")) return "invoice" as const
  if (
    actions.includes("confirm") ||
    actions.includes("cancel") ||
    actions.includes("reschedule")
  ) {
    return "respond" as const
  }
  return null
}

const recipientFor = (channel: MessageChannel, event: AutomationEvent): string | undefined =>
  channel === "email" ? event.email : event.phone

/** Minutes from midnight, clinic-local. */
const minutesOfDay = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** True when a clinic-local time sits inside the quiet window (which may wrap). */
function insideQuietHours(minutes: number, quiet: QuietHours): boolean {
  const start = minutesOfDay(quiet.start)
  const end = minutesOfDay(quiet.end)
  if (start === end) return false
  return start < end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end // wraps past midnight
}

/**
 * Move a send out of the quiet window, or refuse it.
 *
 * Returns null when the message cannot be salvaged — a reminder anchored
 * before an appointment is worthless once the appointment has begun, so it is
 * dropped rather than delivered late.
 */
function applyQuietHours(
  at: Date,
  quiet: QuietHours,
  timezone: string,
  latestUseful: Date | null,
): Date | null {
  if (!quiet.enabled) return at

  const minutes = minutesOfDay(clinicHhmm(at, timezone))
  if (!insideQuietHours(minutes, quiet)) return at

  // Push to the end of the window. Only a wrapping window entered in the
  // evening resolves on the following morning; every other case is same-day.
  const start = minutesOfDay(quiet.start)
  const end = minutesOfDay(quiet.end)
  const wraps = start > end
  const day = clinicIsoDate(at, timezone)
  const targetDay = wraps && minutes >= start ? addIsoDays(day, 1) : day
  const shifted = clinicDateTimeToUtc(timezone, targetDay, quiet.end)

  if (latestUseful && shifted.getTime() > latestUseful.getTime()) return null
  return shifted
}

/**
 * Plan every message an event should produce.
 *
 * Skips: disabled sequences/steps, channels the clinic has switched off,
 * channels with no address for this patient, steps whose anchor the event
 * doesn't carry, and anything that already came due in the past (so replaying
 * an old event cannot fire a stale reminder).
 */
export function planMessages(event: AutomationEvent, ctx: PlanContext): OutboxMessage[] {
  const now = ctx.now ?? new Date()
  const { automations } = ctx
  const timezone = automations.timezone
  const locale = ctx.locale ?? "en-GB"
  const createdAt = now.toISOString()
  const out: OutboxMessage[] = []

  const sequences = automations.sequences.filter(
    (s: AutomationSequence) => s.enabled && s.trigger === event.trigger,
  )

  for (const sequence of sequences) {
    for (const step of sequence.steps) {
      if (!step.enabled) continue

      // Three gates, narrowest last: the clinic's master switch, the patient's
      // own opt-out, and finally whether we have an address at all.
      const channels = step.channels.filter(
        (c) =>
          ctx.channelEnabled[c] &&
          allowsChannel(event.patientId, c) &&
          recipientFor(c, event),
      )
      if (!channels.length) continue

      const instants = dueInstants(step, event, timezone, now)
      if (!instants.length) continue

      // One token per step: the same link backs its WhatsApp and email copy,
      // so a patient who confirms by email doesn't get a dead button later.
      const kind = tokenKindForActions(step.actions)
      const token = kind
        ? mintToken(kind, {
            patientId: event.patientId,
            appointmentId: event.appointmentId,
            invoiceId: event.invoiceId,
            questionnaireId: event.questionnaireId,
            // Frozen here so the landing page never has to read clinic records.
            context: {
              patientName: event.patientName,
              appointmentDate: event.appointmentDate,
              appointmentStart: event.appointmentStart,
              appointmentEnd: event.appointmentEnd,
              amount: event.invoiceAmount,
            },
          })
        : null
      const link = token ? tokenLink(token, ctx.origin) : undefined

      // A message that must arrive before the visit has a hard deadline;
      // quiet-hours shifting may not push it past that.
      const appointmentStart =
        event.appointmentDate && event.appointmentStart
          ? clinicDateTimeToUtc(timezone, event.appointmentDate, event.appointmentStart)
          : null
      const deadline =
        step.schedule.mode === "offset" &&
        step.schedule.anchor === "appointment_start" &&
        step.schedule.minutes < 0
          ? appointmentStart
          : step.schedule.mode === "clock_before"
            ? appointmentStart
            : null

      for (const { at: rawAt, runIndex } of instants) {
        const at = applyQuietHours(rawAt, automations.quietHours, timezone, deadline)
        if (!at) continue

        // A reminder whose moment has passed is noise, not a reminder. Steps
        // scheduled to fire immediately are exempt.
        if (step.schedule.mode !== "immediate" && at.getTime() < now.getTime()) continue

        const display = formatClinicDateTime(
          event.appointmentDate && event.appointmentStart
            ? clinicDateTimeToUtc(timezone, event.appointmentDate, event.appointmentStart)
            : at,
          timezone,
          locale,
        )

        for (const channel of channels) {
          const rendered = renderTemplate(step.template, {
            patient_name: event.patientName,
            clinic_name: ctx.clinicName,
            practitioner_name: ctx.practitionerName,
            date: display.date,
            time: display.time,
            amount: event.invoiceAmount,
            session_number: event.sessionNumber,
            link,
          })

          out.push({
            id: randomId("msg"),
            sequenceId: sequence.id,
            stepId: step.id,
            trigger: event.trigger,
            channel,
            patientId: event.patientId,
            patientName: event.patientName,
            to: recipientFor(channel, event) as string,
            appointmentId: event.appointmentId,
            invoiceId: event.invoiceId,
            scheduledFor: at.toISOString(),
            status: "pending",
            subject: channel === "email" ? rendered.subject : undefined,
            body: rendered.body,
            actions: step.actions,
            token: token?.token,
            runIndex,
            createdAt,
          })
        }
      }
    }
  }

  return out.sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  )
}
