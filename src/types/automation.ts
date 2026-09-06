/**
 * Automation domain — patient-facing reminders, sequences and self-service links.
 *
 * Everything here is transport-agnostic on purpose. The engine decides *what*
 * message should exist and *when*; an adapter decides *how* it leaves the
 * building. Until a real WhatsApp/email provider is wired the adapter only
 * simulates delivery, so the whole flow is exercisable end-to-end today.
 *
 * Clock reference for every schedule rule is the clinic timezone
 * (`ClinicAutomations.timezone`, default Asia/Jerusalem), never the viewer's.
 */

/** Delivery channels. `sms` is kept as a fallback lane, not used by defaults. */
export type MessageChannel = "whatsapp" | "email" | "sms"

/** Business events the engine reacts to. */
export type AutomationTrigger =
  | "appointment.booked"
  | "appointment.reminder"
  | "treatment.completed"
  | "appointment.no_show"
  | "invoice.unpaid"
  | "progress.checkpoint"

/** What a schedule rule counts from. */
export type ScheduleAnchor =
  | "event"
  | "appointment_start"
  | "appointment_end"
  | "no_show_marked"
  | "invoice_issued"

/**
 * When a step fires.
 * - `immediate`   — as soon as the event lands.
 * - `offset`      — N minutes from the anchor; negative = before it.
 * - `clock_before`— a wall-clock time on a calendar day before the anchor
 *                   ("18:00 the evening before"), resolved in clinic timezone.
 * - `recurring`   — first run after N hours, then every M hours until `until`
 *                   becomes true (dunning).
 */
export type ScheduleRule =
  | { mode: "immediate" }
  | { mode: "offset"; anchor: ScheduleAnchor; minutes: number }
  | { mode: "clock_before"; anchor: ScheduleAnchor; daysBefore: number; atTime: string }
  | {
      mode: "recurring"
      anchor: ScheduleAnchor
      firstAfterHours: number
      everyHours: number
      until: "invoice_paid"
      maxRuns: number
    }

/** Buttons rendered inside a message; each maps to a public landing route. */
export type AutomationAction =
  | "confirm"
  | "cancel"
  | "reschedule"
  | "open_invoice"
  | "open_questionnaire"
  | "reply_free_text"
  /**
   * "I already paid." A claim by the patient, never a settlement: no money has
   * been verified and no document may be issued off the back of it. It opens a
   * task for the practitioner, who checks the account and settles by hand —
   * which is what actually issues the invoice-receipt.
   */
  | "declare_paid"

/** Per-channel copy for one step. Bodies are editable in Settings → Automations. */
export interface MessageTemplate {
  /** WhatsApp / SMS body. Supports {patient_name}, {clinic_name}, {date}, {time}, {amount}, {link}. */
  body: string
  /** Email-only subject line. Ignored on WhatsApp/SMS. */
  emailSubject?: string
}

export interface AutomationStep {
  id: string
  enabled: boolean
  /** Short admin-facing name, shown in the sequence editor. */
  name: string
  schedule: ScheduleRule
  channels: MessageChannel[]
  template: MessageTemplate
  actions: AutomationAction[]
  /** Marks copy that touches clinical/emotional ground — surfaced in the editor. */
  sensitive?: boolean
}

export interface AutomationSequence {
  id: string
  trigger: AutomationTrigger
  name: string
  enabled: boolean
  steps: AutomationStep[]
}

/**
 * A window Martin marks as "open for future bookings". Deliberately separate
 * from `weekdays` (clinic opening hours): a patient rescheduling themselves may
 * only land inside these, even though the clinic is technically open elsewhere.
 */
export interface AvailabilityWindow {
  id: string
  /** 0 = Monday … 6 = Sunday, matching WeekdayScheduleSlot. */
  weekdayIndex: number
  startTime: string
  endTime: string
}

export interface SelfBookingSettings {
  enabled: boolean
  /** Require at least one uploaded document before the slot is confirmed. */
  requireDocuments: boolean
  /** Appointment types a patient may pick themselves. */
  allowedTypes: string[]
  /** Minimum notice before the first bookable slot. */
  leadTimeHours: number
  /** How far ahead the public picker shows slots. */
  horizonDays: number
}

/**
 * Hours during which no patient message may go out.
 *
 * Applies to scheduled sends only. A message that lands inside the window is
 * pushed to the end of it — except one anchored before an appointment, which
 * is dropped instead, because a "see you in an hour" delivered after the visit
 * is worse than none at all.
 */
export interface QuietHours {
  enabled: boolean
  /** Clinic-local `HH:mm`. May wrap past midnight (e.g. 21:00 → 08:00). */
  start: string
  end: string
}

export interface ClinicAutomations {
  /** IANA zone all schedule maths resolve in. */
  timezone: string
  sequences: AutomationSequence[]
  futureAvailability: AvailabilityWindow[]
  quietHours: QuietHours
  /** Grace period after the slot ends before a missed visit becomes a no-show. */
  noShowGraceMinutes: number
  /** Send the long progress questionnaire every N completed sessions. */
  progressQuestionnaireEverySessions: number
  selfBooking: SelfBookingSettings
}

/* -------------------------------------------------------------------------- */
/* Outbox                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `simulated` is a real terminal state, not a placeholder: it means the engine
 * produced and rendered the message correctly and the adapter chose not to send.
 * Swapping in a live adapter turns these into `sent` with no other change.
 */
export type OutboxStatus = "pending" | "simulated" | "sent" | "failed" | "cancelled"

export interface OutboxMessage {
  id: string
  sequenceId: string
  stepId: string
  trigger: AutomationTrigger
  channel: MessageChannel
  patientId: string
  patientName: string
  /** Phone for whatsapp/sms, address for email. */
  to: string
  appointmentId?: string
  invoiceId?: string
  /** ISO instant the message becomes due. */
  scheduledFor: string
  status: OutboxStatus
  subject?: string
  body: string
  actions: AutomationAction[]
  /** Public token backing the action buttons, when the step has any. */
  token?: string
  /** Run index for recurring steps (0-based); undefined for one-shot steps. */
  runIndex?: number
  createdAt: string
  sentAt?: string
  error?: string
}

/* -------------------------------------------------------------------------- */
/* Public access tokens                                                        */
/* -------------------------------------------------------------------------- */

export type AccessTokenKind = "book" | "respond" | "questionnaire" | "invoice"

/**
 * Snapshot of what the message said, frozen at mint time.
 *
 * The public pages render from this rather than looking the appointment up.
 * Two reasons: a patient link must not require read access to clinic records,
 * and the page should show what the patient was actually told even if the
 * record has since moved.
 */
export interface AccessTokenContext {
  patientName?: string
  appointmentDate?: string
  appointmentStart?: string
  appointmentEnd?: string
  appointmentType?: string
  amount?: string
}

/**
 * Capability token behind every patient-facing link. It carries the entire
 * authorisation for the public pages — there is no patient login.
 */
export interface AccessToken {
  token: string
  kind: AccessTokenKind
  patientId?: string
  appointmentId?: string
  invoiceId?: string
  questionnaireId?: string
  context?: AccessTokenContext
  createdAt: string
  expiresAt: string
  usedAt?: string
  /** Single-use tokens are burned on first successful action. */
  singleUse: boolean
}

/* -------------------------------------------------------------------------- */
/* Progress questionnaire                                                      */
/* -------------------------------------------------------------------------- */

export type QuestionKind = "scale" | "text" | "choice"

export interface QuestionnaireQuestion {
  id: string
  kind: QuestionKind
  /** i18n key for the prompt. */
  labelKey: string
  /** Choice options as i18n keys. */
  optionKeys?: string[]
  required?: boolean
}

export interface QuestionnaireAnswer {
  questionId: string
  value: string
}

export interface ProgressQuestionnaire {
  id: string
  patientId: string
  patientName: string
  /** Session count that triggered it, e.g. 6th completed visit. */
  sessionNumber: number
  createdAt: string
  completedAt?: string
  answers: QuestionnaireAnswer[]
}

/* -------------------------------------------------------------------------- */
/* Patient self-registration                                                   */
/* -------------------------------------------------------------------------- */

export type IntakeStatus = "invited" | "submitted" | "approved"

/**
 * What a patient fills in through a `/book/<token>` link before the clinic has
 * a record for them. Kept apart from `PatientSummary` on purpose — this is
 * unverified patient-supplied data until Martin approves it.
 */
export interface PatientIntake {
  id: string
  token: string
  fullName: string
  phone: string
  email: string
  dateOfBirth?: string
  reason: string
  /** File names only in mock mode; storage paths once Supabase is live. */
  documentNames: string[]
  requestedType: string
  requestedDate?: string
  requestedStart?: string
  status: IntakeStatus
  createdAt: string
  submittedAt?: string
}

/* -------------------------------------------------------------------------- */
/* Inbound patient responses                                                   */
/* -------------------------------------------------------------------------- */

export type PatientResponseKind =
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "questionnaire"
  /**
   * The patient says they have paid. Unverified by definition — it is a
   * message, not a bank record — so it settles nothing on its own. See
   * `declare_paid`.
   */
  | "payment_claimed"
  /**
   * The patient wrote something in their own words. The clinic asked them to
   * ("message me here directly if anything feels sore"), so it is an open item
   * until a person has read it — never categorised, never auto-answered.
   */
  | "message"

/**
 * A patient action that came back through a link or a WhatsApp button. The
 * dashboard turns the ones needing Martin's attention into reactive tasks.
 */
export interface PatientResponse {
  id: string
  kind: PatientResponseKind
  patientId: string
  patientName: string
  appointmentId?: string
  questionnaireId?: string
  /** The invoice a `payment_claimed` response is about. */
  invoiceId?: string
  /** What the patient wrote, for `message`. Their words, never summarised. */
  body?: string
  /** The number a `message` arrived from, when no patient could be matched. */
  fromAddress?: string
  /** New slot for `rescheduled`, as ISO date + HH:mm. */
  newDate?: string
  newStart?: string
  receivedAt: string
  /** Cleared once Martin has dealt with it. */
  handled: boolean
}
