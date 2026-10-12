"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock3, XIcon } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
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
import { localeToBcp47 } from "@/lib/format-locale"
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
import { findFreeSlots, type FreeSlot } from "@/features/automations/lib/availability"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"

const STATUS_OPTIONS: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "uncertain",
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

/** How far around the chosen date the free-slot suggestions look. */
const SUGGEST_DAYS_BEFORE = 3
const SUGGEST_DAYS_AFTER = 7

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
  const { locale, t } = useLocale()
  const typeVisualBase = useAppointmentTypeVisual()
  const typeVisual = useMemo(() => {
    const next = { ...typeVisualBase }
    const keys: AppointmentType[] = ["first", "adjustments", "kupa"]
    for (const k of keys) {
      next[k] = { ...next[k], label: t(`appt.type.${k}`) }
    }
    return next
  }, [typeVisualBase, t])
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState("")
  /**
   * The patient this booking is for.
   *
   * A typed name used to become `pt-new-<random>`, which Postgres refuses —
   * `patient_id` is a key into the patient list, not a label — so a visit
   * booked from here was never saved at all. The name now searches the
   * clinic's own patients and the chosen one is carried by id; a name nobody
   * answers to is a new patient, and saying so is a deliberate second step.
   */
  const [patientId, setPatientId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allowNewPatient, setAllowNewPatient] = useState(false)
  const patients = useMergedPatients()
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
      setPatientId(appointment.patientId ?? null)
      setAllowNewPatient(false)
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
      setPatientId(stub?.patientId ?? null)
      setAllowNewPatient(false)
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
        return new Intl.DateTimeFormat(localeToBcp47(locale), {
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
      subtitle: t("appointment.preview.minutes", { n: durationMin }),
      dateLabel,
      startMin,
      endMin,
    }
  }, [startHour, startMinute, durationMin, date, locale, t])

  const adjustDuration = (delta: number) => {
    setDurationMin((d) => clampDurationMinutes(d + delta))
  }

  /**
   * The next free slots, so a booking is not found by trial and error.
   *
   * The same free-slot maths the patient-facing booking page uses, but for the
   * practitioner: no lead time, the whole opening day rather than the narrower
   * windows offered to the public, three weeks out. At most two per day, so a
   * quiet morning does not fill the strip with one date.
   */
  const { settings } = useClinicSettings()

  /**
   * Slots that begin where another visit ends, or end where one begins.
   *
   * Depends on the length being booked: a 20-minute visit is back to back with
   * a 10:00 appointment only if it starts at 09:40.
   */
  const adjacentSlots = useMemo(() => {
    const edges = new Set<string>()
    for (const a of allAppointments) {
      if (a.status === "cancelled") continue
      edges.add(`${a.date}|${a.end}`)
      edges.add(`${a.date}|${hhmmFromMinutes(minutesFromHHMM(a.start) - durationMin)}`)
    }
    return edges
  }, [allAppointments, durationMin])

  const suggestions = useMemo<FreeSlot[]>(() => {
    if (!open || mode !== "create") return []
    const openDays = settings.weekdays.filter((w) => w.open)
    /*
     * Searched around the chosen day, not from today.
     *
     * The search walks forward in five-minute steps and stops at a limit, so
     * starting from today it ran out after about six working days: a date
     * picked two weeks ahead was never reached, and every suggestion came
     * from this week. Three days either side of the chosen date — never
     * earlier than now — is the window the practitioner is actually choosing in.
     */
    const realNow = new Date()
    const windowStart = fromISODate(date)
    windowStart.setDate(windowStart.getDate() - SUGGEST_DAYS_BEFORE)
    const searchFrom = windowStart.getTime() > realNow.getTime() ? windowStart : realNow
    const slots = findFreeSlots({
      now: searchFrom,
      automations: {
        ...settings.automations,
        selfBooking: {
          ...settings.automations.selfBooking,
          leadTimeHours: 0,
          horizonDays: SUGGEST_DAYS_BEFORE + SUGGEST_DAYS_AFTER,
        },
        futureAvailability: openDays.map((w) => ({
          id: `open-${w.weekdayIndex}`,
          weekdayIndex: w.weekdayIndex,
          startTime: w.openTime,
          endTime: w.closeTime,
        })),
      },
      weekdays: settings.weekdays,
      appointments: allAppointments,
      durationMinutes: durationMin,
      limit: 5000,
    })
    /*
     * Offered around the day and hour already chosen, not from today onwards.
     * The practitioner picks the date and time he has in mind first; what the
     * strip is for is the nearest thing that is actually free to it. And a
     * slot that touches an existing visit comes first, because a day packed
     * back to back is the one he wants — a free hour between two patients is
     * an hour he is at the clinic for nothing.
     */
    const wanted = startHour * 60 + startMinute
    const dayDistance = (iso: string) =>
      Math.abs(Math.round((fromISODate(iso).getTime() - fromISODate(date).getTime()) / 86_400_000))

    // Within this of the chosen hour counts as "about then": inside it a slot
    // that touches another visit wins, outside it nearness to the hour does.
    const NEAR_MINUTES = 120

    const ranked = slots
      .map((slot) => {
        const minutes = Math.abs(minutesFromHHMM(slot.start) - wanted)
        return {
          slot,
          adjacent: adjacentSlots.has(`${slot.date}|${slot.start}`),
          days: dayDistance(slot.date),
          near: minutes <= NEAR_MINUTES,
          minutes,
        }
      })
      .sort(
        (a, b) =>
          a.days - b.days ||
          Number(b.near) - Number(a.near) ||
          Number(b.adjacent) - Number(a.adjacent) ||
          a.minutes - b.minutes,
      )

    // The chosen day gets most of the strip; the days around it are the
    // fallback. Spaced apart, because 12:00 and 12:05 are the same answer
    // twice — except a slot touching a visit, which is worth its own chip.
    const lastPerDay = new Map<string, number[]>()
    const picked: FreeSlot[] = []
    for (const { slot, adjacent } of ranked) {
      const chosenDay = slot.date === date
      const taken = lastPerDay.get(slot.date) ?? []
      if (taken.length >= (chosenDay ? 4 : 2)) continue
      const start = minutesFromHHMM(slot.start)
      const spacing = chosenDay ? 30 : 60
      if (!adjacent && taken.some((m) => Math.abs(m - start) < spacing)) continue
      lastPerDay.set(slot.date, [...taken, start])
      picked.push(slot)
      if (picked.length >= 8) break
    }
    return picked
  }, [open, mode, settings, allAppointments, durationMin, date, startHour, startMinute, adjacentSlots])

  const slotLabel = (slot: FreeSlot) => {
    try {
      const day = new Intl.DateTimeFormat(localeToBcp47(locale), {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(fromISODate(slot.date))
      return `${day} · ${slot.start}`
    } catch {
      return `${slot.date} · ${slot.start}`
    }
  }

  /** Patients whose name or number answers to what was typed. */
  const matches = useMemo(() => {
    const q = patientName.trim().toLowerCase()
    if (!q) return []
    const digits = q.replace(/\D/g, "")
    return patients
      .filter((p) => {
        if (p.fullName.toLowerCase().includes(q)) return true
        return digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits)
      })
      .slice(0, 6)
  }, [patientName, patients])

  const chosen = useMemo(
    () => (patientId ? patients.find((p) => p.id === patientId) ?? null : null),
    [patientId, patients],
  )

  const choosePatient = (p: { id: string; fullName: string }) => {
    setPatientId(p.id)
    setPatientName(p.fullName)
    setAllowNewPatient(false)
    setPickerOpen(false)
    setError(null)
  }

  const applySuggestion = (slot: FreeSlot) => {
    const startMin = minutesFromHHMM(slot.start)
    setDate(slot.date)
    setStartHour(Math.floor(startMin / 60))
    setStartMinute(startMin % 60)
    setError(null)
  }

  /** Solo practice — no practitioner field; persisted `provider` stays empty / legacy untouched in spread. */
  const handleSave = () => {
    const startMin = preview.startMin
    const endMin = preview.endMin

    if (startMinute % APPOINTMENT_SLOT_MINUTES !== 0) {
      setError(t("appointment.error.minutesStep", { slot: APPOINTMENT_SLOT_MINUTES }))
      return
    }

    if (durationMin < MIN_APPOINTMENT_MINUTES || durationMin > MAX_APPOINTMENT_MINUTES) {
      setError(
        t("appointment.error.durationRange", {
          min: MIN_APPOINTMENT_MINUTES,
          max: MAX_APPOINTMENT_MINUTES,
        }),
      )
      return
    }

    if (durationMin % APPOINTMENT_SLOT_MINUTES !== 0) {
      setError(t("appointment.error.durationMultiple", { slot: APPOINTMENT_SLOT_MINUTES }))
      return
    }

    if (!isWithinCalendarDayWindow(startMin, endMin)) {
      setError(t("appointment.error.hours"))
      return
    }

    const name = patientName.trim()
    if (!name) {
      setError(t("appointment.error.name"))
      return
    }
    // A booking has to belong to someone the clinic holds. Typing a name that
    // matches nobody used to mint an id the database refuses, so the visit was
    // silently lost; now it asks first.
    if (mode === "create" && !patientId && !allowNewPatient) {
      setPickerOpen(true)
      setError(t("appointment.error.pickPatient"))
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
        t("appointment.error.overlap", {
          name: conflict.patientName,
          start: conflict.start,
          end: conflict.end,
        }),
      )
      return
    }

    const dayLabel = (() => {
      const today = toISODate(new Date())
      if (date === today) return t("calendar.day.today")
      try {
        return new Intl.DateTimeFormat(localeToBcp47(locale), { weekday: "long" }).format(fromISODate(date))
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
            // Preserve the patient when a stub carried one (patient page / search),
            // otherwise treat it as a brand-new patient.
            patientId: patientId || appointment?.patientId || `pt-new-${crypto.randomUUID().slice(0, 8)}`,
            patientName: name,
            date,
            dayLabel,
            provider: "",
            start: hhmmFromMinutes(startMin),
            end: hhmmFromMinutes(endMin),
            status,
            treatment: treatment.trim() || t("appointment.treatmentFallback"),
            appointmentType: apptType,
          }

    onSave(item, { isNew: mode === "create" })
    onOpenChange(false)
  }

  const handleCancelTreatment = () => {
    if (!appointment) return
    onSave({ ...appointment, status: "cancelled" }, { isNew: false })
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
          {mode === "create" ? t("appointment.create.subtitle") : t("appointment.edit.subtitle")}
        </DialogDescription>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-5 right-5 z-20 rounded-xl text-white hover:bg-white/15"
              aria-label={t("appointment.close")}
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="relative shrink-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
          <DialogHeader className="relative gap-0 space-y-0">
            <DialogTitle className="font-heading pr-12 text-xl font-semibold tracking-tight text-white">
              {mode === "create" ? t("appointment.scheduleSlot") : t("appointment.update")}
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
                  {t("appointment.field.patient")}
                </label>
                <div className="relative">
                  <Input
                    id="appt-patient"
                    value={patientName}
                    onChange={(e) => {
                      setPatientName(e.target.value)
                      // Typing again means the chosen patient no longer matches
                      // what is on screen, so the booking is unattached until a
                      // name is picked from the list.
                      setPatientId(null)
                      setAllowNewPatient(false)
                      setPickerOpen(true)
                    }}
                    onFocus={() => setPickerOpen(true)}
                    placeholder={t("appointment.field.fullName")}
                    autoComplete="off"
                    className="h-11 rounded-xl border-slate-200 text-base"
                  />
                  {chosen ? (
                    <p className="mt-1 text-[11px] font-medium text-emerald-700">
                      {t("appointment.patient.linked", { name: chosen.fullName })}
                    </p>
                  ) : allowNewPatient ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      {t("appointment.patient.willCreate")}
                    </p>
                  ) : null}

                  {pickerOpen && patientName.trim() && !chosen ? (
                    <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => choosePatient(p)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm hover:bg-sky-50"
                        >
                          <span className="truncate font-medium text-slate-800">{p.fullName}</span>
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">
                            {p.phone || ""}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setAllowNewPatient(true)
                          setPatientId(null)
                          setPickerOpen(false)
                          setError(null)
                        }}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-start text-sm text-slate-500 hover:bg-slate-50"
                      >
                        {matches.length
                          ? t("appointment.patient.newInstead")
                          : t("appointment.patient.noneFound")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label className={LABEL} htmlFor="appt-notes">
                  {t("appointment.field.note")}
                </label>
                <Input
                  id="appt-notes"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  placeholder={t("appointment.field.treatmentPlaceholder")}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
            </div>

            <Separator className="my-3 shrink-0" />

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className={LABEL} htmlFor="appt-date">
                  {t("appointment.field.date")}
                </label>
                <input
                  id="appt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || toISODate(new Date()))}
                  className={CONTROL}
                />
                <p className="text-[11px] text-slate-400">
                  {mode === "edit" ? t("appointment.date.hint.edit") : t("appointment.date.hint.create")}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className={LABEL}>{t("appointment.field.startTime")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-500" htmlFor="appt-hour">
                      {t("appointment.field.hour")}
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
                      {t("appointment.field.minutesCol")}
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

              {/* Below the date *and* the time, because it is offered around
                  both: the practitioner sets the day and the hour he has in
                  mind, then sees what is actually free near it. Between the
                  two it read as an answer to the date alone. */}
              {mode === "create" ? (
                <div className="grid gap-1.5">
                  <p className={LABEL}>{t("appointment.nextFree.title")}</p>
                  {suggestions.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((slot) => {
                        const isChosen =
                          slot.date === date && minutesFromHHMM(slot.start) === preview.startMin
                        const backToBack = adjacentSlots.has(`${slot.date}|${slot.start}`)
                        return (
                          <button
                            key={`${slot.date}-${slot.start}`}
                            type="button"
                            onClick={() => applySuggestion(slot)}
                            title={backToBack ? t("appointment.nextFree.adjacent") : undefined}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs tabular-nums transition-colors",
                              isChosen
                                ? "border-slate-900 bg-slate-900 text-white"
                                : backToBack
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50",
                            )}
                          >
                            {/* A slot that touches another visit keeps the day
                                packed; it is worth seeing at a glance. */}
                            {backToBack ? <span aria-hidden>↔</span> : null}
                            {slotLabel(slot)}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">{t("appointment.nextFree.none")}</p>
                  )}
                  {/* Said in words on the page: the tooltip that used to
                      explain the mark never appears on a tablet. */}
                  {suggestions.some((slot) => adjacentSlots.has(`${slot.date}|${slot.start}`)) ? (
                    <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                      <span aria-hidden>↔</span>
                      {t("appointment.nextFree.adjacentLegend")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-2">
                <p className={LABEL}>{t("appointment.field.duration")}</p>
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
                    {t("appointment.field.visitType")}
                  </label>
                  <select
                    id="appt-type"
                    className={CONTROL}
                    value={apptType}
                    onChange={(e) => setApptType(e.target.value as AppointmentType)}
                  >
                    {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {typeVisual[opt].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className={LABEL} htmlFor="appt-status">
                    {t("appointment.field.status")}
                  </label>
                  <select
                    id="appt-status"
                    className={CONTROL}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {t(`appt.status.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="relative z-[1] mx-0 mb-0 mt-0 shrink-0 rounded-b-3xl border-t border-slate-200/95 bg-slate-50 px-6 py-3 sm:flex-row sm:justify-end sm:gap-3">
            {mode === "edit" && appointment && appointment.status !== "cancelled" ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11 rounded-xl me-auto"
                onClick={handleCancelTreatment}
              >
                {t("appointment.footer.cancelTreatment")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
              {t("appointment.footer.cancel")}
            </Button>
            <Button type="submit" className="h-11 rounded-xl bg-emerald-700 px-6 font-semibold hover:bg-emerald-800">
              {t("appointment.footer.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
