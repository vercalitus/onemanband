"use client"

import { useCallback, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { issueInvoiceForVisit } from "@/features/automations/lib/billing-bridge"
import { clinicIsoDate } from "@/features/automations/lib/clinic-time"
import {
  onInvoiceIssued,
  onRebookingNeeded,
  planContextFromSettings,
} from "@/features/automations/lib/events"
import { settleMessage, settleVisit } from "@/features/finances/lib/settle-visit"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { AppointmentType, PaymentMethod, ScheduleItem } from "@/types/domain"

/**
 * Everything that happens when a session is closed, other than the record
 * itself.
 *
 * Closing a session used to write a `treatments` row and stop. The visit stayed
 * "scheduled" in the diary, no charge existed for it, and a patient who left
 * without booking simply drifted — so the three things that actually follow a
 * treatment were each somebody's job to remember, done on a different screen,
 * or not done.
 *
 * The rule, in the practitioner's words: the patient pays and usually books the
 * next visit at the desk, so closing the session should leave them with a
 * receipt and a booked time. Whichever of the two did not happen is what gets
 * sent.
 *
 * So, in order:
 *
 *  1. **The charge for this visit**, at the amount confirmed while closing —
 *     not the list price, which is only where that amount starts.
 *  2. **Paid** → the money is recorded and the חשבונית מס קבלה is filed, which
 *     also stops any payment chasing. **Not paid** → the debt stays open and
 *     the reminder ladder starts.
 *  3. **The diary**: today's visit is marked completed, through the one booking
 *     path, which is what fires the after-treatment messages and the progress
 *     questionnaire.
 *  4. **Nothing booked** → an invitation to pick a time. A patient who booked
 *     at the desk is never sent one.
 *
 * The invoice is created here, before the visit is marked completed, precisely
 * so the amount is the practitioner's rather than the price list's: the
 * automation that bills a completed visit finds this invoice already there and
 * leaves it alone — that idempotency is the same one that stops a double-click
 * billing a patient twice.
 */

export interface CloseSessionInput {
  patientId: string
  patientName: string
  appointmentType: AppointmentType
  /** What this visit is charged, in shekels. Editable while closing. */
  amount: number
  paid: boolean
  method: PaymentMethod
}

export interface CloseSessionOutcome {
  /** What the tax document did, in the practitioner's language. */
  billingMessage?: string
  /** True when the filing failed and somebody has to look. */
  billingFailed?: boolean
  /** True when an invitation to book was queued. */
  invitedToBook: boolean
}

/** A visit that is neither cancelled nor already history. */
const isLive = (a: ScheduleItem) => a.status !== "cancelled"

export function useSessionClosing(patientId: string) {
  const { t, localeTag, formatMoney } = useLocale()
  const { appointments, commitAppointment } = useScheduleDay()
  const patients = useMergedPatients()
  const [closing, setClosing] = useState(false)

  const today = useMemo(
    () => clinicIsoDate(new Date(), readClinicSettingsSafe().automations.timezone),
    [],
  )

  /**
   * The visit being closed: this patient's booking for today, the earliest one
   * not already completed. Absent when the practitioner never put it in the
   * diary, which is allowed — the session still closes and the charge is raised
   * against the day instead.
   */
  const todaysAppointment = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === patientId && a.date === today && isLive(a))
        .sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
        .find((a) => a.status !== "completed") ?? null,
    [appointments, patientId, today],
  )

  /**
   * The next visit they have, if any. Anything still to come counts — later
   * today, next week, a course booked months ahead — because the question this
   * answers is only "does this person have to be chased to book".
   *
   * The diary is read four months ahead (see `fetchAppointments`), so a booking
   * beyond that horizon would not be seen. Nobody in this clinic books one.
   */
  const nextAppointment = useMemo(() => {
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
    return (
      appointments
        .filter(
          (a) =>
            a.patientId === patientId &&
            isLive(a) &&
            a.status !== "completed" &&
            a.status !== "no_show" &&
            (a.date > today || (a.date === today && minutesFromHHMM(a.start) > nowMinutes)),
        )
        .sort((a, b) =>
          a.date === b.date
            ? minutesFromHHMM(a.start) - minutesFromHHMM(b.start)
            : a.date.localeCompare(b.date),
        )[0] ?? null
    )
  }, [appointments, patientId, today])

  const closeSession = useCallback(
    async (input: CloseSessionInput): Promise<CloseSessionOutcome> => {
      setClosing(true)
      try {
        const settings = readClinicSettings()
        const ctx = planContextFromSettings(settings, {
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
          locale: localeTag,
        })
        const patient = patients.find((p) => p.id === input.patientId)
        const visit = todaysAppointment
        const visitDate = visit?.date ?? today

        let billingMessage: string | undefined
        let billingFailed = false

        // 1 — the charge. Nothing here is conditional on payment: an invoice
        // exists either way, because a visit that was paid for still needs a
        // document and a visit that was not still needs chasing.
        const issued = await issueInvoiceForVisit({
          patientId: input.patientId,
          patientName: input.patientName,
          appointmentId: visit?.id,
          treatmentType: input.appointmentType,
          amount: input.amount,
          visitDate,
          provider: settings.integrations.billingProvider,
          reason: "visit",
        })

        if (!issued.ok) {
          // No row means no debt and no document. Say so rather than closing
          // the session as if the money had been dealt with.
          billingMessage = t("patientChart.close.billingUnavailable")
          billingFailed = true
        } else if (input.paid) {
          // 2a — paid. Recording it and filing the document are one action;
          // settling also cancels anything queued to chase this invoice.
          const result = await settleVisit({
            invoice: issued.invoice,
            patient,
            payment: { amount: input.amount, method: input.method, date: visitDate },
            live: await clinicHasPatients(),
            formatMoney,
          })
          const said = settleMessage(result, t)
          billingMessage = said.message
          billingFailed = !said.ok
        } else if (issued.created) {
          // 2b — not paid. The ladder starts from the issue date; only for an
          // invoice that is new, so re-closing a session cannot chase twice.
          onInvoiceIssued(
            {
              patientId: input.patientId,
              patientName: input.patientName,
              phone: patient?.phone,
              email: patient?.email,
              invoiceId: issued.invoice.id,
              invoiceAmount: issued.invoice.displayAmount,
              invoiceIssuedDate: visitDate,
            },
            ctx,
          )
        }

        // 3 — the diary. Through `commitAppointment` like every other change to
        // a booking, so the after-treatment messages are planned against the
        // row the database actually holds.
        if (visit) {
          commitAppointment({ ...visit, status: "completed" }, { isNew: false })
        }

        // 4 — and only if they are leaving with nothing booked.
        const invitedToBook = !nextAppointment
        if (invitedToBook) {
          onRebookingNeeded(
            {
              patientId: input.patientId,
              patientName: input.patientName,
              phone: patient?.phone,
              email: patient?.email,
            },
            ctx,
          )
        }

        return { billingMessage, billingFailed, invitedToBook }
      } finally {
        setClosing(false)
      }
    },
    [
      commitAppointment,
      formatMoney,
      localeTag,
      nextAppointment,
      patients,
      t,
      today,
      todaysAppointment,
    ],
  )

  return { todaysAppointment, nextAppointment, closeSession, closing }
}

/** Settings are read before the browser is certain to be there. */
function readClinicSettingsSafe() {
  try {
    return readClinicSettings()
  } catch {
    return { automations: { timezone: "Asia/Jerusalem" } } as ReturnType<typeof readClinicSettings>
  }
}
