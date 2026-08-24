"use client"

import { useCallback } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  onAppointmentBooked,
  onAppointmentCancelled,
  onAppointmentRescheduled,
  onNoShow,
  onTreatmentCompleted,
  planContextFromSettings,
} from "@/features/automations/lib/events"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { formatIls } from "@/lib/format-ils"
import { patients, todaySchedule, weeklySchedule } from "@/lib/mock-data"
import type { ScheduleItem } from "@/types/domain"

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
          case "no_show":
            onNoShow(
              {
                ...input,
                invoiceAmount: priceForType(settings, next),
              },
              ctx,
            )
            break
          case "completed":
            onTreatmentCompleted(
              {
                ...input,
                invoiceAmount: priceForType(settings, next),
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
    [localeTag],
  )
}

function priceForType(
  settings: ReturnType<typeof readClinicSettings>,
  item: ScheduleItem,
): string | undefined {
  const row = settings.treatmentTypes.find((t) => t.type === item.appointmentType)
  return row ? formatIls(row.priceIls) : undefined
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
