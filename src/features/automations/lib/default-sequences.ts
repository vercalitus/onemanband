import type { AutomationSequence } from "@/types/automation"

/**
 * The clinic's out-of-the-box automation playbook.
 *
 * These are seed values, not constants: they land in ClinicSettings and become
 * fully editable in Settings → Automations. Copy is English here because
 * English is the authoritative settings language (see AGENTS.md); locale
 * overlays translate it for display, and anything Martin edits wins outright.
 *
 * Placeholders available in every body: {patient_name} {clinic_name} {date}
 * {time} {amount} {link}.
 */
export function defaultSequences(): AutomationSequence[] {
  return [
    /* ---------------------------------------------------------------- */
    /* 1 — Booking confirmed                                             */
    /* ---------------------------------------------------------------- */
    {
      id: "seq-booking",
      trigger: "appointment.booked",
      name: "Booking confirmation",
      enabled: true,
      steps: [
        {
          id: "step-booking-confirm",
          enabled: true,
          name: "Immediately after booking",
          schedule: { mode: "immediate" },
          channels: ["whatsapp", "email"],
          actions: ["confirm", "cancel", "reschedule"],
          template: {
            emailSubject: "Your appointment at {clinic_name} — {date} {time}",
            body:
              "Hi {patient_name}, your appointment at {clinic_name} is booked for {date} at {time}. " +
              "Manage it here: {link}",
          },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    /* 2 — Reminder ladder before the visit                              */
    /* ---------------------------------------------------------------- */
    {
      id: "seq-reminders",
      trigger: "appointment.reminder",
      name: "Pre-appointment reminders",
      enabled: true,
      steps: [
        {
          id: "step-reminder-evening",
          enabled: true,
          name: "18:00 the evening before",
          // Wall-clock, not an offset: 18:00 clinic time on the previous day,
          // whatever hour the appointment itself sits at.
          schedule: {
            mode: "clock_before",
            anchor: "appointment_start",
            daysBefore: 1,
            atTime: "18:00",
          },
          channels: ["whatsapp", "email"],
          actions: ["confirm", "cancel", "reschedule"],
          template: {
            emailSubject: "Reminder: {clinic_name} tomorrow at {time}",
            body:
              "Hi {patient_name}, a reminder about your appointment at {clinic_name} tomorrow, " +
              "{date} at {time}. Confirm, cancel or move it here: {link}",
          },
        },
        {
          id: "step-reminder-hour",
          enabled: true,
          name: "One hour before — WhatsApp only",
          schedule: { mode: "offset", anchor: "appointment_start", minutes: -60 },
          // Deliberately no email: the last nudge should not fill an inbox.
          channels: ["whatsapp"],
          actions: ["confirm", "cancel", "reschedule"],
          template: {
            body:
              "Hi {patient_name}, see you in an hour at {clinic_name} ({time}). " +
              "Anything changed? {link}",
          },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    /* 3 — After the treatment                                           */
    /* ---------------------------------------------------------------- */
    {
      id: "seq-post-treatment",
      trigger: "treatment.completed",
      name: "Post-treatment follow-up",
      enabled: true,
      steps: [
        {
          id: "step-post-checkin",
          enabled: true,
          name: "Right after the session",
          schedule: { mode: "immediate" },
          channels: ["whatsapp"],
          actions: ["reply_free_text"],
          sensitive: true,
          template: {
            body:
              "{patient_name}, thanks for coming in today. If anything feels sore or off after " +
              "the treatment, message me here directly — I'd rather hear it early.",
          },
        },
        // There is deliberately no "send the invoice" step here. The
        // bookkeeping provider emails the invoice-receipt itself as part of
        // issuing it, so a step of ours would put a second copy of the same
        // document in the patient's inbox.
        {
          id: "step-post-wellbeing",
          enabled: true,
          name: "Three hours later — how are you feeling",
          schedule: { mode: "offset", anchor: "appointment_end", minutes: 180 },
          channels: ["whatsapp"],
          actions: ["reply_free_text"],
          sensitive: true,
          template: {
            body:
              "Hi {patient_name}, how are you feeling a few hours on? Some tenderness is normal. " +
              "Keep moving gently, drink water, and tell me if anything sharp shows up.",
          },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    /* 4 — Missed the appointment without notice                         */
    /* ---------------------------------------------------------------- */
    {
      id: "seq-no-show",
      trigger: "appointment.no_show",
      name: "No-show follow-up",
      enabled: true,
      steps: [
        {
          id: "step-no-show-notice",
          enabled: true,
          name: "After the grace period",
          // Fires off the moment the visit is marked no-show; the waiting is
          // done by `noShowGraceMinutes` before the mark, not here.
          schedule: { mode: "offset", anchor: "no_show_marked", minutes: 0 },
          channels: ["whatsapp", "email"],
          // Rebooking only. There is no document to attach: a missed visit was
          // never paid for, and the invoice-receipt is a receipt. If a fee is
          // owed it is chased by the payment reminders, which is a different
          // sequence doing a different job.
          actions: ["reschedule"],
          template: {
            emailSubject: "Missed appointment at {clinic_name} — {date}",
            body:
              "Hi {patient_name}, we kept your {time} slot on {date} open and you weren't able to " +
              "make it. Book a new time whenever you're ready: {link}",
          },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    /* 5 — Unpaid invoice dunning                                        */
    /* ---------------------------------------------------------------- */
    {
      id: "seq-unpaid",
      trigger: "invoice.unpaid",
      name: "Payment reminders",
      enabled: true,
      steps: [
        {
          id: "step-unpaid-daily",
          enabled: true,
          name: "24h after issue, then daily until paid",
          schedule: {
            mode: "recurring",
            anchor: "invoice_issued",
            firstAfterHours: 24,
            everyHours: 24,
            until: "invoice_paid",
            // Stops the queue growing without bound if nothing ever settles;
            // by then it is a phone call, not another message.
            maxRuns: 14,
          },
          channels: ["whatsapp"],
          // A notice, not a document. The invoice-receipt is a receipt: it may
          // only exist once the money has actually arrived, so this message
          // carries no invoice and no payment link — just the amount and a way
          // for the patient to say they have already paid.
          actions: ["declare_paid"],
          template: {
            body:
              "Hi {patient_name}, a gentle reminder that {amount} for your session on {date} is " +
              "still open. Already paid? Let me know here: {link}",
          },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    /* 6 — Periodic progress questionnaire                               */
    /* ---------------------------------------------------------------- */
    {
      id: "seq-progress",
      trigger: "progress.checkpoint",
      name: "Progress questionnaire",
      enabled: true,
      steps: [
        {
          id: "step-progress-send",
          enabled: true,
          name: "On the session checkpoint",
          schedule: { mode: "immediate" },
          channels: ["whatsapp", "email"],
          actions: ["open_questionnaire"],
          template: {
            emailSubject: "Progress check-in before your next session",
            body:
              "Hi {patient_name}, we're {session_number} sessions in. Before your longer review " +
              "session, could you fill in this short progress questionnaire? {link}",
          },
        },
      ],
    },
  ]
}
