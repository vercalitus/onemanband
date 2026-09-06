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

type View = "loading" | "invalid" | "choose" | "reschedule" | "payment" | "done"
type Outcome = "confirmed" | "cancelled" | "rescheduled" | "payment_claimed"

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
  const [invoiceId, setInvoiceId] = useState<string>("")
  const [busy, setBusy] = useState(false)

  /**
   * Resolve the link after mount, locally first and then from the server.
   *
   * Local first because in mock mode the practitioner's own browser holds the
   * token and carries the snapshot the message was built from — name, date,
   * amount — which the server copy deliberately does not store. Server second
   * because that is the normal case: the patient is on their own phone, where
   * nothing local exists.
   */
  useEffect(() => {
    let cancelled = false
    setSettings(readClinicSettings())

    const apply = (token: {
      kind: string
      patientId?: string
      appointmentId?: string
      invoiceId?: string
      context?: AccessTokenContext | null
    }) => {
      setAppointmentId(token.appointmentId ?? "")
      setPatientId(token.patientId ?? "")
      setInvoiceId(token.invoiceId ?? "")
      // The page renders from the token's own snapshot, never from clinic records.
      setContext(token.context ?? null)
      // An invoice token is a payment notice, not an appointment reminder —
      // same route, different question to ask.
      setView(token.kind === "invoice" ? "payment" : "choose")
    }

    const local = resolveToken(token)
    if (local.ok) {
      apply(local.token)
      return
    }

    void (async () => {
      try {
        const res = await fetch(`/api/automations/public/token/${encodeURIComponent(token)}`, {
          cache: "no-store",
        })
        const body = (await res.json()) as
          | { ok: true; token: Parameters<typeof apply>[0] }
          | { ok: false; reason: string }
        if (cancelled) return
        if (!body.ok) {
          setReason(body.reason)
          setView("invalid")
          return
        }
        apply(body.token)
      } catch {
        if (cancelled) return
        // Unreachable rather than invalid: telling someone their link is dead
        // when the network simply failed would send them to the clinic for
        // nothing.
        setReason("unreachable")
        setView("invalid")
      }
    })()

    return () => {
      cancelled = true
    }
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
    // Local first, so the same-browser demo path keeps working unchanged.
    recordPatientResponse({
      kind,
      patientId,
      patientName,
      appointmentId: appointmentId || undefined,
      invoiceId: invoiceId || undefined,
      newDate: slot?.date,
      newStart: slot?.start,
    })
    // And to the server, which is the copy that actually reaches the clinic:
    // this page is running on the patient's phone, and nothing written here
    // would otherwise leave it. The identity of the response is taken from the
    // stored token, not from this body.
    void fetch("/api/automations/public/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        kind,
        patientName,
        newDate: slot?.date,
        newStart: slot?.start,
      }),
    }).catch(() => {})
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

  /**
   * Payment notice. There is deliberately no invoice to open and no amount to
   * pay online: the invoice-receipt is a receipt, so it cannot exist before the
   * money does. All the patient can do here is tell the clinic they have
   * already paid — a claim the practitioner then checks against the account.
   */
  if (view === "payment") {
    return (
      <PublicShell
        clinicName={clinicName}
        title={t("public.payment.title")}
        subtitle={
          // The amount comes from the token snapshot, which only the browser
          // that minted the link holds. On the patient's phone it is absent,
          // and a sentence with a hole where a number should be is worse than
          // one written without it.
          context?.amount
            ? t("public.payment.subtitle", { amount: context.amount })
            : t("public.payment.subtitleGeneric")
        }
      >
        <div className="grid gap-3">
          <Button
            className="h-12 justify-start gap-3 text-base"
            disabled={busy}
            onClick={() => finish("payment_claimed")}
          >
            <Check className="size-5" aria-hidden />
            {t("public.payment.declare")}
          </Button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          {t("public.payment.footnote")}
        </p>
      </PublicShell>
    )
  }

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
