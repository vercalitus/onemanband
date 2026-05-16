"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock3, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { AppointmentStatus, AppointmentType, ScheduleItem } from "@/types/domain"
import {
  MAX_APPOINTMENT_MINUTES,
  MIN_APPOINTMENT_MINUTES,
  APPOINTMENT_SLOT_MINUTES,
} from "@/types/domain"
import { APPOINTMENT_TYPE_OPTIONS } from "@/lib/appointment-types"
import { useAppointmentTypeVisual } from "@/lib/use-appointment-type-visual"
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  clampDurationMinutes,
  clampStartForDuration,
  findOverlappingAppointment,
  hhmmFromMinutes,
  isWithinCalendarDayWindow,
  minutesFromHHMM,
  snapMinutesToSlotNearest,
} from "@/lib/appointment-time"
import { fromISODate, toISODate } from "@/lib/date-helpers"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]

const MINUTE_OPTIONS = Array.from({ length: 60 / APPOINTMENT_SLOT_MINUTES }, (_, i) => i * APPOINTMENT_SLOT_MINUTES)

const HOUR_OPTIONS = Array.from(
  { length: CALENDAR_HOUR_END - CALENDAR_HOUR_START },
  (_, i) => CALENDAR_HOUR_START + i,
)

const DURATION_QUICK = [5, 10, 15, 30, 45, 60] as const

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"

const CONTROL =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition-[border-color,box-shadow] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-200"

export type AppointmentEditorMode = "create" | "edit"

export function AppointmentEditDialog({
  open,
  onOpenChange,
  mode,
  appointment,
  defaultStartMinutes,
  defaultDate,
  allAppointments,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: AppointmentEditorMode
  appointment: ScheduleItem | null
  defaultStartMinutes?: number
  /** ISO YYYY-MM-DD. Used in create mode to pre-fill the date (e.g. the day picked in the calendar). */
  defaultDate?: string
  allAppointments: ScheduleItem[]
  onSave: (item: ScheduleItem, meta: { isNew: boolean }) => void
}) {
  const typeVisual = useAppointmentTypeVisual()
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState("")
  const [treatment, setTreatment] = useState("")
  const [startHour, setStartHour] = useState(CALENDAR_HOUR_START)
  const [startMinute, setStartMinute] = useState(0)
  const [durationMin, setDurationMin] = useState(15)
  const [status, setStatus] = useState<AppointmentStatus>("scheduled")
  const [apptType, setApptType] = useState<AppointmentType>("adjustments")
  // The appointment's calendar date. Edit-mode prefills with the existing date;
  // create-mode prefills with the date the caller passed (mini-calendar selection).
  const [date, setDate] = useState<string>(() => toISODate(new Date()))

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === "edit" && appointment) {
      const sm = minutesFromHHMM(appointment.start)
      const em = minutesFromHHMM(appointment.end)
      setStartHour(Math.floor(sm / 60))
      setStartMinute(sm % 60)
      setDurationMin(em - sm)
      setPatientName(appointment.patientName)
      setTreatment(appointment.treatment)
      setStatus(appointment.status)
      setApptType(appointment.appointmentType)
      setDate(appointment.date ?? toISODate(new Date()))
      return
    }
    if (mode === "create") {
      // If the caller passed an appointment stub (e.g. from a patient page),
      // honour its fields as pre-fills. Otherwise fall back to fresh defaults.
      const stub = appointment
      const base =
        defaultStartMinutes ??
        (stub ? minutesFromHHMM(stub.start) : CALENDAR_HOUR_START * 60 + 60)
      const snapped = snapMinutesToSlotNearest(base)
      const dur = stub
        ? minutesFromHHMM(stub.end) - minutesFromHHMM(stub.start)
        : 15
      const clampedStart = clampStartForDuration(snapped, dur)
      setStartHour(Math.floor(clampedStart / 60))
      setStartMinute(clampedStart % 60)
      setDurationMin(dur)
      setPatientName(stub?.patientName ?? "")
      setTreatment(stub?.treatment ?? "")
      setStatus(stub?.status ?? "scheduled")
      setApptType(stub?.appointmentType ?? "adjustments")
      setDate(defaultDate ?? stub?.date ?? toISODate(new Date()))
    }
  }, [open, mode, appointment, defaultStartMinutes, defaultDate])

  const preview = useMemo(() => {
    const startMin = startHour * 60 + startMinute
    const endMin = startMin + durationMin
    const dateLabel = (() => {
      try {
        return new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(fromISODate(date))
      } catch {
        return date
      }
    })()
    return {
      line: `${hhmmFromMinutes(startMin)} · ${hhmmFromMinutes(endMin)}`,
      subtitle: `${durationMin} minute visit`,
      dateLabel,
      startMin,
      endMin,
    }
  }, [startHour, startMinute, durationMin, date])

  const adjustDuration = (delta: number) => {
    setDurationMin((d) => clampDurationMinutes(d + delta))
  }

  /** Solo practice — no practitioner field; persisted `provider` stays empty / legacy untouched in spread. */
  const handleSave = () => {
    const startMin = preview.startMin
    const endMin = preview.endMin

    if (startMinute % APPOINTMENT_SLOT_MINUTES !== 0) {
      setError(`Minutes must be in ${APPOINTMENT_SLOT_MINUTES}-minute steps.`)
      return
    }

    if (durationMin < MIN_APPOINTMENT_MINUTES || durationMin > MAX_APPOINTMENT_MINUTES) {
      setError(`Duration must be between ${MIN_APPOINTMENT_MINUTES} and ${MAX_APPOINTMENT_MINUTES} minutes.`)
      return
    }

    if (durationMin % APPOINTMENT_SLOT_MINUTES !== 0) {
      setError(`Duration must be a multiple of ${APPOINTMENT_SLOT_MINUTES} minutes.`)
      return
    }

    if (!isWithinCalendarDayWindow(startMin, endMin)) {
      setError("Appointment must stay within clinic hours (08:00–19:00).")
      return
    }

    const name = patientName.trim()
    if (!name) {
      setError("Patient name is required.")
      return
    }

    // Only consider conflicts on the same calendar day as the appointment being saved.
    const sameDayAppointments = allAppointments.filter((a) => a.date === date)
    const conflict = findOverlappingAppointment(
      sameDayAppointments,
      startMin,
      endMin,
      mode === "edit" ? appointment?.id : undefined,
    )
    if (conflict) {
      setError(
        `That time overlaps with ${conflict.patientName} (${conflict.start}–${conflict.end}). Choose a different time.`,
      )
      return
    }

    // Compute a friendly day label so the table-style views keep reading naturally.
    const dayLabel = (() => {
      const today = toISODate(new Date())
      if (date === today) return "Today"
      try {
        return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(fromISODate(date))
      } catch {
        return date
      }
    })()

    const item: ScheduleItem =
      mode === "edit" && appointment
        ? {
            ...appointment,
            patientName: name,
            treatment: treatment.trim() || appointment.treatment,
            provider: "",
            date,
            dayLabel,
            start: hhmmFromMinutes(startMin),
            end: hhmmFromMinutes(endMin),
            status,
            appointmentType: apptType,
          }
        : {
            id: crypto.randomUUID(),
            patientId: `pt-new-${crypto.randomUUID().slice(0, 8)}`,
            patientName: name,
            date,
            dayLabel,
            provider: "",
            start: hhmmFromMinutes(startMin),
            end: hhmmFromMinutes(endMin),
            status,
            treatment: treatment.trim() || "Visit",
            appointmentType: apptType,
          }

    onSave(item, { isNew: mode === "create" })
    onOpenChange(false)
  }

  const typeChip = typeVisual[apptType].chip

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Do not use `relative` here — tailwind-merge would override Base `fixed` and break viewport centering.
          "flex max-h-[min(90dvh,calc(100dvh-2rem))] min-h-0 w-full flex-col gap-0 overflow-hidden rounded-3xl border-slate-200/90 p-0 shadow-2xl sm:max-w-lg",
        )}
      >
        <DialogDescription className="sr-only">
          {mode === "create" ? "Create a new appointment for today." : "Change visit time or details."}
        </DialogDescription>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-5 right-5 z-20 rounded-xl text-white hover:bg-white/15"
              aria-label="Close"
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="relative shrink-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
          <DialogHeader className="relative gap-0 space-y-0">
            <DialogTitle className="font-heading pr-12 text-xl font-semibold tracking-tight text-white">
              {mode === "create" ? "Schedule a slot" : "Update appointment"}
            </DialogTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${typeChip}`}>
                {typeVisual[apptType].label}
              </span>
              <div className="flex items-center gap-2 text-sm text-sky-100">
                <CalendarDays className="size-4 shrink-0 text-sky-300" aria-hidden />
                <span className="font-medium">{preview.dateLabel}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-sm tabular-nums text-sky-100">
                <Clock3 className="size-4 shrink-0 text-sky-300" aria-hidden />
                <span>{preview.line}</span>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-50 ring-1 ring-white/15">
                {preview.subtitle}
              </span>
            </div>
          </DialogHeader>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-4">
            {error ? (
              <p
                className="mb-3 rounded-xl border border-rose-200/90 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <label className={LABEL} htmlFor="appt-patient">
                  Patient
                </label>
                <Input
                  id="appt-patient"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Full name"
                  className="h-11 rounded-xl border-slate-200 text-base"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label className={LABEL} htmlFor="appt-notes">
                  Note
                </label>
                <Input
                  id="appt-notes"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  placeholder="Brief reason / focus area"
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
            </div>

            <Separator className="my-3 shrink-0" />

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className={LABEL} htmlFor="appt-date">
                  Date
                </label>
                <input
                  id="appt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || toISODate(new Date()))}
                  className={CONTROL}
                />
                <p className="text-[11px] text-slate-400">
                  {mode === "edit"
                    ? "Change the date to move this appointment to another day."
                    : "Select the day for the new appointment."}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className={LABEL}>Start time</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-500" htmlFor="appt-hour">
                      Hour
                    </label>
                    <select
                      id="appt-hour"
                      className={CONTROL}
                      value={startHour}
                      onChange={(e) => {
                        const h = Number(e.target.value)
                        setStartHour(h)
                        const startMin = h * 60 + startMinute
                        const next = clampStartForDuration(startMin, durationMin)
                        setStartHour(Math.floor(next / 60))
                        setStartMinute(next % 60)
                      }}
                    >
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-500" htmlFor="appt-min">
                      Minutes
                    </label>
                    <select
                      id="appt-min"
                      className={CONTROL}
                      value={startMinute}
                      onChange={(e) => {
                        const m = Number(e.target.value)
                        const startMin = startHour * 60 + m
                        const next = clampStartForDuration(startMin, durationMin)
                        setStartHour(Math.floor(next / 60))
                        setStartMinute(next % 60)
                      }}
                    >
                      {MINUTE_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <p className={LABEL}>Duration</p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_QUICK.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={durationMin === d ? "default" : "outline"}
                      className={cn(
                        "h-9 rounded-full px-4 text-xs font-semibold",
                        durationMin === d && "bg-emerald-600 text-white hover:bg-emerald-600",
                      )}
                      onClick={() => {
                        const nextDur = clampDurationMinutes(d)
                        setDurationMin(nextDur)
                        const startMin = startHour * 60 + startMinute
                        const nextStart = clampStartForDuration(startMin, nextDur)
                        setStartHour(Math.floor(nextStart / 60))
                        setStartMinute(nextStart % 60)
                      }}
                    >
                      {d}m
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl border-slate-200"
                    onClick={() => adjustDuration(-APPOINTMENT_SLOT_MINUTES)}
                  >
                    −{APPOINTMENT_SLOT_MINUTES}m
                  </Button>
                  <span className="rounded-xl bg-slate-100 px-4 py-2 font-mono text-sm font-semibold text-slate-800 tabular-nums">
                    {durationMin} min
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl border-slate-200"
                    onClick={() => adjustDuration(APPOINTMENT_SLOT_MINUTES)}
                  >
                    +{APPOINTMENT_SLOT_MINUTES}m
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className={LABEL} htmlFor="appt-type">
                    Visit type
                  </label>
                  <select
                    id="appt-type"
                    className={CONTROL}
                    value={apptType}
                    onChange={(e) => setApptType(e.target.value as AppointmentType)}
                  >
                    {APPOINTMENT_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {typeVisual[t].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className={LABEL} htmlFor="appt-status">
                    Status
                  </label>
                  <select
                    id="appt-status"
                    className={CONTROL}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="relative z-[1] mx-0 mb-0 mt-0 shrink-0 rounded-b-3xl border-t border-slate-200/95 bg-slate-50 px-6 py-3 sm:flex-row sm:justify-end sm:gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-xl bg-emerald-700 px-6 font-semibold hover:bg-emerald-800">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
