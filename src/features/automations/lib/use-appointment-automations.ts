"use client"

import { useCallback } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { issueInvoiceForVisit } from "@/features/automations/lib/billing-bridge"
import {
  onAppointmentBooked,
  onAppointmentCancelled,
  onAppointmentRescheduled,
  onInvoiceIssued,
  onNoShow,
  onTreatmentCompleted,
  planContextFromSettings,
} from "@/features/automations/lib/events"
import type { PlanContext } from "@/features/automations/lib/plan-messages"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { todaySchedule, weeklySchedule } from "@/lib/mock-data"
import type { PatientSummary, ScheduleItem } from "@/types/domain"

/**
 * Bridge between the schedule UI and the automation engine.
 *
 * The calendar's job is to move appointments around; deciding that a completed
 * visit owes the patient three messages is not its business. Both the day view
 * and the week view call this one hook so the rules cannot drift apart between
 * them.
 *
 * Every call is fire-and-forget: automation failures must never block a
 * clinician from saving an appointment.
 */
export function useAppointmentAutomations() {
  const { localeTag } = useLocale()
  /**
   * The clinic's own patients. This lookup is where a reminder gets the number
   * to send to — against the mock list a real patient is not found, `phone`
   * and `email` come back undefined, and the planner drops every channel for
   * want of a recipient. The visit saves, and no reminder is ever queued.
   */
  const patients = useMergedPatients()

  return useCallback(
    (next: ScheduleItem, meta: { isNew: boolean; previous?: ScheduleItem | null }) => {
      try {
        const settings = readClinicSettings()
        const ctx = planContextFromSettings(settings, {
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
          locale: localeTag,
        })

        const patient = patients.find((p) => p.id === next.patientId)
        const input = {
          patientId: next.patientId,
          patientName: next.patientName,
          phone: patient?.phone,
          email: patient?.email,
          appointmentId: next.id,
          appointmentDate: next.date,
          appointmentStart: next.start,
          appointmentEnd: next.end,
        }

        if (meta.isNew) {
          onAppointmentBooked(input, ctx)
          return
        }

        const previous =
          meta.previous ?? [...todaySchedule, ...weeklySchedule].find((a) => a.id === next.id) ?? null

        // A move is a change of slot, not of status — check it first so a
        // rescheduled visit re-lays its reminder ladder.
        const moved =
          previous && (previous.date !== next.date || previous.start !== next.start)
        if (moved && next.status !== "cancelled") {
          onAppointmentRescheduled(input, ctx)
          return
        }

        if (previous?.status === next.status) return

        switch (next.status) {
          case "cancelled":
            onAppointmentCancelled(next.id)
            break

          // A missed visit is still billable, so it takes the same invoice
          // path as a completed one — the sequence attaches it to the notice.
          case "no_show":
            onNoShow({ ...input, ...bill(settings, next, "no_show", ctx, patients) }, ctx)
            break

          case "completed":
            onTreatmentCompleted(
              {
                ...input,
                ...bill(settings, next, "visit", ctx, patients),
                completedSessions: completedSessionsFor(next.patientId) + 1,
              },
              ctx,
            )
            break

          default:
            break
        }
      } catch {
        // Never let an automation problem swallow a schedule edit.
      }
    },
    [localeTag, patients],
  )
}

/**
 * Issue the invoice for a visit and start its payment-reminder ladder.
 *
 * Returns the ids the message templates need, so the notice a patient receives
 * points at a real invoice rather than quoting a number that exists nowhere.
 * Idempotent: `issueInvoiceForVisit` keys off the appointment, and the dunning
 * sequence is only started for a newly created invoice.
 */
function bill(
  settings: ReturnType<typeof readClinicSettings>,
  item: ScheduleItem,
  reason: "visit" | "no_show",
  ctx: PlanContext,
  /** Passed in rather than imported — see the note in the hook above. */
  patients: PatientSummary[],
): { invoiceId?: string; invoiceAmount?: string; invoiceIssuedDate?: string } {
  const row = settings.treatmentTypes.find((t) => t.type === item.appointmentType)
  if (!row) return {}

  const patient = patients.find((p) => p.id === item.patientId)
  const { invoice, created } = issueInvoiceForVisit({
    patientId: item.patientId,
    patientName: item.patientName,
    appointmentId: item.id,
    treatmentType: item.appointmentType,
    amount: row.priceIls,
    visitDate: item.date,
    provider: settings.integrations.billingProvider,
    reason,
  })

  if (created) {
    onInvoiceIssued(
      {
        patientId: item.patientId,
        patientName: item.patientName,
        phone: patient?.phone,
        email: patient?.email,
        invoiceId: invoice.id,
        invoiceAmount: invoice.displayAmount,
        invoiceIssuedDate: item.date,
      },
      ctx,
    )
  }

  return {
    invoiceId: invoice.id,
    invoiceAmount: invoice.displayAmount,
    invoiceIssuedDate: item.date,
  }
}

/**
 * How many visits this patient has already completed — drives the every-Nth
 * questionnaire checkpoint. Counts the mock schedule today; a single Supabase
 * count replaces it later.
 */
function completedSessionsFor(patientId: string): number {
  return [...todaySchedule, ...weeklySchedule].filter(
    (a) => a.patientId === patientId && a.status === "completed",
  ).length
}
