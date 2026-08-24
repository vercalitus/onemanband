"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Check, Loader2, X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { PublicNotice, PublicShell } from "@/features/automations/components/public-shell"
import { SlotPicker } from "@/features/automations/components/slot-picker"
import { findFreeSlots, type FreeSlot } from "@/features/automations/lib/availability"
import { recordPatientResponse } from "@/features/automations/lib/events"
import { markTokenUsed } from "@/features/automations/lib/automation-store"
import { resolveToken } from "@/features/automations/lib/tokens"
import { minutesFromHHMM } from "@/lib/appointment-time"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { todaySchedule, weeklySchedule } from "@/lib/mock-data"
import type { AccessTokenContext } from "@/types/automation"
import type { ClinicSettings } from "@/types/clinic-settings"

type View = "loading" | "invalid" | "choose" | "reschedule" | "done"
type Outcome = "confirmed" | "cancelled" | "rescheduled"

/**
 * Landing page for the action buttons in a reminder.
 *
 * The three outcomes are not symmetrical and the layout says so: confirming is
 * one tap and ends the visit here; cancelling is destructive so it asks once;
 * rescheduling opens the slot picker, which only ever offers windows the
 * practitioner marked as giveable.
 */
export function RespondPageClient({ token }: { token: string }) {
  const { t, localeTag } = useLocale()
  const [view, setView] = useState<View>("loading")
  const [reason, setReason] = useState<string>("")
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [context, setContext] = useState<AccessTokenContext | null>(null)
  const [appointmentId, setAppointmentId] = useState<string>("")
  const [patientId, setPatientId] = useState<string>("")
  const [busy, setBusy] = useState(false)

  // Token resolution has to happen after mount: in mock mode the store is
  // localStorage, which does not exist during server render.
  useEffect(() => {
    setSettings(readClinicSettings())
    const resolution = resolveToken(token)
    if (!resolution.ok) {
      setReason(resolution.reason)
      setView("invalid")
      return
    }
    setAppointmentId(resolution.token.appointmentId ?? "")
    setPatientId(resolution.token.patientId ?? "")
    // The page renders from the token's own snapshot, not from clinic records.
    setContext(resolution.token.context ?? null)
    setView("choose")
  }, [token])

  const slots = useMemo<FreeSlot[]>(() => {
    if (!settings || view !== "reschedule") return []
    // Duration falls back to the appointment's own length when the token
    // recorded it, so a 45-minute first visit isn't offered a 30-minute slot.
    const recorded =
      context?.appointmentStart && context?.appointmentEnd
        ? minutesFromHHMM(context.appointmentEnd) - minutesFromHHMM(context.appointmentStart)
        : null
    return findFreeSlots({
      automations: settings.automations,
      weekdays: settings.weekdays,
      appointments: [...todaySchedule, ...weeklySchedule],
      durationMinutes: recorded && recorded > 0 ? recorded : 30,
      limit: 90,
    })
  }, [settings, view, context])

  const patientName = context?.patientName ?? ""

  const finish = (kind: Outcome, slot?: FreeSlot) => {
    setBusy(true)
    recordPatientResponse({
      kind,
      patientId,
      patientName,
      appointmentId: appointmentId || undefined,
      newDate: slot?.date,
      newStart: slot?.start,
    })
    // Reminder tokens stay reusable (a patient may confirm then reschedule),
    // so this only stamps `usedAt` for the audit trail.
    markTokenUsed(token)
    setOutcome(kind)
    setView("done")
    setBusy(false)
  }

  const clinicName = settings?.profile.clinicName ?? ""

  if (view === "loading") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.respond.title")}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin text-sky-600" aria-hidden />
          {t("public.loading")}
        </div>
      </PublicShell>
    )
  }

  if (view === "invalid") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.respond.title")}>
        <PublicNotice
          tone="error"
          title={t(`public.token.${reason}`)}
          body={t("public.token.contactClinic")}
        />
      </PublicShell>
    )
  }

  if (view === "done") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.respond.title")}>
        <PublicNotice
          tone={outcome === "cancelled" ? "info" : "success"}
          title={t(`public.respond.done.${outcome}`)}
          body={t("public.respond.done.body")}
        />
      </PublicShell>
    )
  }

  const when =
    context?.appointmentDate && context?.appointmentStart
      ? `${new Intl.DateTimeFormat(localeTag, { dateStyle: "full" }).format(
          new Date(`${context.appointmentDate}T00:00:00`),
        )} · ${context.appointmentStart}`
      : t("public.respond.unknownSlot")

  if (view === "reschedule") {
    return (
      <PublicShell
        clinicName={clinicName}
        title={t("public.respond.rescheduleTitle")}
        subtitle={t("public.respond.rescheduleSubtitle")}
      >
        <SlotPicker
          slots={slots}
          onPick={(slot) => finish("rescheduled", slot)}
          emptyLabel={t("public.slots.none")}
        />
        <Button variant="ghost" className="mt-4 text-slate-600" onClick={() => setView("choose")}>
          {t("public.back")}
        </Button>
      </PublicShell>
    )
  }

  return (
    <PublicShell
      clinicName={clinicName}
      title={t("public.respond.title")}
      subtitle={t("public.respond.subtitle", { when })}
    >
      <div className="grid gap-3">
        <Button
          className="h-12 justify-start gap-3 text-base"
          disabled={busy}
          onClick={() => finish("confirmed")}
        >
          <Check className="size-5" aria-hidden />
          {t("public.respond.confirm")}
        </Button>
        <Button
          variant="outline"
          className="h-12 justify-start gap-3 border-slate-200 text-base text-slate-800"
          disabled={busy}
          onClick={() => setView("reschedule")}
        >
          <CalendarClock className="size-5" aria-hidden />
          {t("public.respond.reschedule")}
        </Button>
        <Button
          variant="outline"
          className="h-12 justify-start gap-3 border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-base text-[rgb(140,92,68)]"
          disabled={busy}
          onClick={() => finish("cancelled")}
        >
          <X className="size-5" aria-hidden />
          {t("public.respond.cancel")}
        </Button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">{t("public.respond.footnote")}</p>
    </PublicShell>
  )
}
