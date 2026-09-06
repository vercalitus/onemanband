"use client"

import {
  DEFAULT_CLINIC_TIMEZONE,
  clinicDateTimeToUtc,
  clinicHhmm,
  clinicIsoDate,
} from "@/features/automations/lib/clinic-time"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { AppointmentStatus, AppointmentType, ScheduleItem } from "@/types/domain"

/**
 * Appointments, read from Postgres instead of the mock file.
 *
 * The interesting part is the boundary between two ways of describing a
 * moment. Postgres stores an instant (`timestamptz`); the app works in clinic
 * wall-clock — "the 09:40 on Tuesday" — because that is what a practitioner
 * and a patient both mean. Israel observes daylight saving, so the conversion
 * has to go through the clinic's timezone in both directions and never through
 * a fixed offset or the viewer's own clock.
 *
 * Read on the practitioner's session so row-level security decides which
 * clinic's day comes back, exactly as with patients.
 */

const TZ = DEFAULT_CLINIC_TIMEZONE

interface AppointmentRow {
  id: string
  patient_id: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  appointment_type: AppointmentType
  notes: string | null
  patients?: { full_name: string } | null
}

function toScheduleItem(row: AppointmentRow): ScheduleItem {
  const start = new Date(row.start_time)
  const end = new Date(row.end_time)
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patients?.full_name ?? "",
    date: clinicIsoDate(start, TZ),
    // Filled by the UI from `date` when it needs a human label; there is no
    // sense in freezing a localised weekday name into the data layer.
    dayLabel: "",
    provider: "",
    start: clinicHhmm(start, TZ),
    end: clinicHhmm(end, TZ),
    status: row.status,
    treatment: row.notes ?? "",
    appointmentType: row.appointment_type,
  }
}

const SELECT = "id, patient_id, start_time, end_time, status, appointment_type, notes, patients(full_name)"

export type AppointmentFetch =
  | { source: "live"; appointments: ScheduleItem[] }
  | { source: "unavailable"; reason: string }

/**
 * A window of days around today, rather than everything ever booked.
 *
 * The calendar shows a month at most and the dashboard a day; loading a
 * clinic's entire history to render either would get slower every year for no
 * benefit anyone can see.
 */
export async function fetchAppointments(
  options: { fromDaysBack?: number; toDaysAhead?: number } = {},
): Promise<AppointmentFetch> {
  const db = createSupabaseBrowserClient()
  if (!db) return { source: "unavailable", reason: "supabase not configured" }

  const now = new Date()
  const from = new Date(now.getTime() - (options.fromDaysBack ?? 60) * 86_400_000)
  const to = new Date(now.getTime() + (options.toDaysAhead ?? 120) * 86_400_000)

  const { data, error } = await db
    .from("appointments")
    .select(SELECT)
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString())
    .order("start_time", { ascending: true })

  if (error) return { source: "unavailable", reason: error.message }
  return {
    source: "live",
    appointments: (data as unknown as AppointmentRow[]).map(toScheduleItem),
  }
}

async function currentClinicId(): Promise<string | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", auth.user.id)
    .maybeSingle()
  return data?.clinic_id ?? null
}

export type AppointmentWrite =
  | { ok: true; appointment: ScheduleItem }
  | { ok: false; reason: string }

/**
 * Postgres rejects an overlapping booking outright — the exclusion constraint
 * is the only place in this system where two people cannot hold the same slot,
 * because it is the only place that sees all the bookings at once. Its error is
 * translated here rather than shown raw: a practitioner needs to know the slot
 * is taken, not to read a constraint name.
 */
function explain(error: { message: string; code?: string }): string {
  if (error.code === "23P01" || /appointments_no_overlap/.test(error.message)) {
    return "That slot overlaps another appointment."
  }
  if (/duration|five_minute|five_step|second_zero/.test(error.message)) {
    return "Appointments run in 5-minute steps, from 5 to 60 minutes."
  }
  return error.message
}

export async function saveAppointment(
  item: ScheduleItem,
  { isNew }: { isNew: boolean },
): Promise<AppointmentWrite> {
  const db = createSupabaseBrowserClient()
  if (!db) return { ok: false, reason: "supabase not configured" }

  const startTime = clinicDateTimeToUtc(TZ, item.date, item.start).toISOString()
  const endTime = clinicDateTimeToUtc(TZ, item.date, item.end).toISOString()

  const fields = {
    patient_id: item.patientId,
    start_time: startTime,
    end_time: endTime,
    status: item.status,
    appointment_type: item.appointmentType,
    notes: item.treatment || null,
  }

  if (!isNew && item.id) {
    const { data, error } = await db
      .from("appointments")
      .update(fields)
      .eq("id", item.id)
      .select(SELECT)
      .single()
    if (error) return { ok: false, reason: explain(error) }
    return { ok: true, appointment: toScheduleItem(data as unknown as AppointmentRow) }
  }

  const clinicId = await currentClinicId()
  if (!clinicId) return { ok: false, reason: "no clinic for this user" }

  const { data, error } = await db
    .from("appointments")
    .insert({ ...fields, clinic_id: clinicId })
    .select(SELECT)
    .single()
  if (error) return { ok: false, reason: explain(error) }
  return { ok: true, appointment: toScheduleItem(data as unknown as AppointmentRow) }
}

/**
 * Cancelling rather than deleting. A visit that was booked and then called off
 * is part of the record — it is why a slot went empty and why a no-show fee
 * may exist — so the row stays and its status changes.
 */
export async function cancelAppointment(id: string): Promise<AppointmentWrite | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data, error } = await db
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select(SELECT)
    .single()
  if (error) return { ok: false, reason: explain(error) }
  return { ok: true, appointment: toScheduleItem(data as unknown as AppointmentRow) }
}
