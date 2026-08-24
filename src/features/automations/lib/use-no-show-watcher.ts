"use client"

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { ensureNoShowWatermark } from "@/features/automations/lib/automation-store"
import { issueInvoiceForVisit } from "@/features/automations/lib/billing-bridge"
import { clinicDateTimeToUtc } from "@/features/automations/lib/clinic-time"
import { onInvoiceIssued, onNoShow, planContextFromSettings } from "@/features/automations/lib/events"
import { findMissedAppointments } from "@/features/automations/lib/no-show-watch"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { patients } from "@/lib/mock-data"
import type { ScheduleItem } from "@/types/domain"

/** How often to sweep. A minute is well inside any sane grace period. */
const SWEEP_MS = 60_000

/**
 * Marks silently-missed visits as no-shows and fires their sequence.
 *
 * This is the "wait a defined time, then message automatically" half of the
 * no-show rule — without it `noShowGraceMinutes` only describes an intention.
 *
 * Two safeguards keep it from misfiring:
 * - Visits that ended before the watcher first ran are ignored (watermark),
 *   so shipping this does not retroactively bill historical appointments.
 * - Each appointment is handled once per session, so a sweep landing while
 *   React state is still catching up cannot double-charge.
 */
export function useNoShowWatcher(
  appointments: ScheduleItem[],
  setAppointments: Dispatch<SetStateAction<ScheduleItem[]>>,
) {
  const { localeTag } = useLocale()
  const handled = useRef<Set<string>>(new Set())
  // Read through a ref so the interval never restarts on a schedule edit.
  const latest = useRef(appointments)
  latest.current = appointments

  useEffect(() => {
    const sweep = () => {
      try {
        const settings = readClinicSettings()
        const watermark = new Date(ensureNoShowWatermark()).getTime()
        const now = new Date()

        const missed = findMissedAppointments(latest.current, settings.automations, now).filter(
          (appointment) => {
            if (handled.current.has(appointment.id)) return false
            const endedAt = clinicDateTimeToUtc(
              settings.automations.timezone,
              appointment.date,
              appointment.end,
            ).getTime()
            return endedAt > watermark
          },
        )
        if (!missed.length) return

        const ctx = planContextFromSettings(settings, {
          origin: window.location.origin,
          locale: localeTag,
          now,
        })

        for (const appointment of missed) {
          handled.current.add(appointment.id)

          const patient = patients.find((p) => p.id === appointment.patientId)
          const price = settings.treatmentTypes.find(
            (t) => t.type === appointment.appointmentType,
          )?.priceIls

          let invoiceId: string | undefined
          let invoiceAmount: string | undefined
          if (price !== undefined) {
            const { invoice, created } = issueInvoiceForVisit({
              patientId: appointment.patientId,
              patientName: appointment.patientName,
              appointmentId: appointment.id,
              treatmentType: appointment.appointmentType,
              amount: price,
              visitDate: appointment.date,
              provider: settings.integrations.billingProvider,
              reason: "no_show",
            })
            invoiceId = invoice.id
            invoiceAmount = invoice.displayAmount
            if (created) {
              onInvoiceIssued(
                {
                  patientId: appointment.patientId,
                  patientName: appointment.patientName,
                  phone: patient?.phone,
                  email: patient?.email,
                  invoiceId: invoice.id,
                  invoiceAmount: invoice.displayAmount,
                  invoiceIssuedDate: appointment.date,
                },
                ctx,
              )
            }
          }

          onNoShow(
            {
              patientId: appointment.patientId,
              patientName: appointment.patientName,
              phone: patient?.phone,
              email: patient?.email,
              appointmentId: appointment.id,
              appointmentDate: appointment.date,
              appointmentStart: appointment.start,
              appointmentEnd: appointment.end,
              invoiceId,
              invoiceAmount,
              invoiceIssuedDate: appointment.date,
            },
            ctx,
          )
        }

        const missedIds = new Set(missed.map((a) => a.id))
        setAppointments((prev) =>
          prev.map((a) => (missedIds.has(a.id) ? { ...a, status: "no_show" as const } : a)),
        )
      } catch {
        // A watcher failure must never take the schedule down with it.
      }
    }

    sweep()
    const timer = window.setInterval(sweep, SWEEP_MS)
    return () => window.clearInterval(timer)
  }, [localeTag, setAppointments])
}
