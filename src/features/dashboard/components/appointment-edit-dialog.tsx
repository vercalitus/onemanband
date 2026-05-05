"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { AppointmentStatus, AppointmentType, ScheduleItem } from "@/types/domain"
import {
  MAX_APPOINTMENT_MINUTES,
  MIN_APPOINTMENT_MINUTES,
  APPOINTMENT_SLOT_MINUTES,
} from "@/types/domain"
import { appointmentTypeVisual, APPOINTMENT_TYPE_OPTIONS } from "@/lib/appointment-types"
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

export type AppointmentEditorMode = "create" | "edit"

export function AppointmentEditDialog({
  open,
  onOpenChange,
  mode,
  appointment,
  defaultStartMinutes,
  allAppointments,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: AppointmentEditorMode
  appointment: ScheduleItem | null
  defaultStartMinutes?: number
  allAppointments: ScheduleItem[]
  onSave: (item: ScheduleItem, meta: { isNew: boolean }) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState("")
  const [treatment, setTreatment] = useState("")
  const [provider, setProvider] = useState("")
  const [startHour, setStartHour] = useState(CALENDAR_HOUR_START)
  const [startMinute, setStartMinute] = useState(0)
  const [durationMin, setDurationMin] = useState(15)
  const [status, setStatus] = useState<AppointmentStatus>("scheduled")
  const [apptType, setApptType] = useState<AppointmentType>("adjustments")

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
      setProvider(appointment.provider)
      setStatus(appointment.status)
      setApptType(appointment.appointmentType)
      return
    }
    if (mode === "create") {
      const base = defaultStartMinutes ?? CALENDAR_HOUR_START * 60 + 60
      const snapped = snapMinutesToSlotNearest(base)
      const dur = 15
      const clampedStart = clampStartForDuration(snapped, dur)
      setStartHour(Math.floor(clampedStart / 60))
      setStartMinute(clampedStart % 60)
      setDurationMin(dur)
      setPatientName("")
      setTreatment("")
      setProvider("Dr. Rivera")
      setStatus("scheduled")
      setApptType("adjustments")
    }
  }, [open, mode, appointment, defaultStartMinutes])

  const preview = useMemo(() => {
    const startMin = startHour * 60 + startMinute
    const endMin = startMin + durationMin
    return `${hhmmFromMinutes(startMin)} – ${hhmmFromMinutes(endMin)} (${durationMin} min)`
  }, [startHour, startMinute, durationMin])

  const adjustDuration = (delta: number) => {
    setDurationMin((d) => clampDurationMinutes(d + delta))
  }

  const handleSave = () => {
    const startMin = startHour * 60 + startMinute
    const endMin = startMin + durationMin

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

    const conflict = findOverlappingAppointment(
      allAppointments,
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

    const item: ScheduleItem =
      mode === "edit" && appointment
        ? {
            ...appointment,
            patientName: name,
            treatment: treatment.trim() || appointment.treatment,
            provider: provider.trim() || appointment.provider,
            start: hhmmFromMinutes(startMin),
            end: hhmmFromMinutes(endMin),
            status,
            appointmentType: apptType,
          }
        : {
            id: crypto.randomUUID(),
            patientId: `pt-new-${crypto.randomUUID().slice(0, 8)}`,
            patientName: name,
            dayLabel: "Today",
            provider: provider.trim() || "Dr. Rivera",
            start: hhmmFromMinutes(startMin),
            end: hhmmFromMinutes(endMin),
            status,
            treatment: treatment.trim() || "Visit",
            appointmentType: apptType,
          }

    onSave(item, { isNew: mode === "create" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New appointment" : "Reschedule appointment"}</DialogTitle>
          <DialogDescription>
            Start and duration use {APPOINTMENT_SLOT_MINUTES}-minute steps. Overlapping times are not allowed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {error && (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-600">Patient</span>
            <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Full name" />
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-600">Treatment note</span>
            <Input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Reason / note" />
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-600">Provider</span>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Provider name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Start hour</span>
              <select
                className={cn(
                  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200",
                )}
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
                    {String(h).padStart(2, "0")}:00 hour
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Start minutes</span>
              <select
                className={cn(
                  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200",
                )}
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

          <div className="grid gap-2">
            <span className="text-xs font-medium text-slate-600">Duration</span>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_QUICK.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={durationMin === d ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs"
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
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(-APPOINTMENT_SLOT_MINUTES)}>
                −{APPOINTMENT_SLOT_MINUTES}m
              </Button>
              <span className="font-mono text-sm text-slate-700 tabular-nums">{durationMin} min</span>
              <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(APPOINTMENT_SLOT_MINUTES)}>
                +{APPOINTMENT_SLOT_MINUTES}m
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Visit type</span>
              <select
                className={cn(
                  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200",
                )}
                value={apptType}
                onChange={(e) => setApptType(e.target.value as AppointmentType)}
              >
                {APPOINTMENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {appointmentTypeVisual[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select
                className={cn(
                  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200",
                )}
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

          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 tabular-nums">{preview}</p>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
