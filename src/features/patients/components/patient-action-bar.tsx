"use client"

import { Calendar, CheckCircle2, Receipt } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { Button } from "@/components/ui/button"
import { toISODate } from "@/lib/date-helpers"
import type { AppointmentType } from "@/types/domain"

interface Props {
  outstandingDebt: number
  onCompleteSession: () => void
  onIssueInvoice: () => void
  patientId: string
  patientName: string
  lastAppointmentType?: AppointmentType
  nextSessionNumber?: number
}

export function PatientActionBar({
  outstandingDebt,
  onCompleteSession,
  onIssueInvoice,
  patientId,
  patientName,
  lastAppointmentType = "adjustments",
  nextSessionNumber,
}: Props) {
  const { t, localeTag } = useLocale()
  const { openCreateAppointment } = useScheduleDay()

  /**
   * One tap, and what it opens is the confirmation.
   *
   * This used to be two taps four seconds apart, because a session closed by a
   * hand brushing the bar became a permanent record the schema refuses to
   * unwrite. The sheet that now opens does that job better: it cannot be
   * triggered by accident, and it is where the visit's charge, its payment and
   * the next booking are settled — none of which a second tap could ask.
   */
  const completeLabel = t("patientChart.completeSession")
  const handleComplete = () => onCompleteSession()

  /**
   * Booking goes through the shared scheduler, not a dialog of this page's own.
   *
   * This card used to render its own copy, whose save handler closed it and
   * navigated to the calendar — so the appointment was never written anywhere
   * and simply was not there when the practitioner arrived. The dialog the
   * provider owns is the one that writes the booking through to Postgres and
   * takes it back off the board if the slot is already taken. Its overlap check
   * also sees the real diary; this one was comparing against the demo day.
   */
  const openScheduleNext = () => {
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    openCreateAppointment(
      toISODate(nextWeek),
      { id: patientId, name: patientName },
      {
        appointmentType: lastAppointmentType,
        treatment: nextSessionNumber
          ? t("patientChart.sessionStub", { n: nextSessionNumber, name: patientName })
          : "",
      },
    )
  }

  const hasDebt = outstandingDebt > 0
  const debtLabel = hasDebt
    ? t("patientChart.outstandingDebt", {
        amount: outstandingDebt.toLocaleString(localeTag),
      })
    : undefined

  /** The amount still owed, as the one orange outline the state vocabulary allows a debt. */
  const debtTag = hasDebt && (
    <span className="inline-flex min-h-6 items-center rounded-[4px] border-[1.5px] border-signal px-2 text-sm font-medium tabular-nums">
      ₪{outstandingDebt.toLocaleString(localeTag)}
    </span>
  )

  return (
    <>
      {/* ── Phone: sticky bottom bar ──
          It sits exactly where a writing hand rests on a tablet held upright,
          so like the session card it carries no selectable text and no
          long-press menu: a palm on "Complete Session" must not raise
          "Look Up / Translate" over the page being written. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 border-t border-hair bg-paper p-3 select-none [-webkit-touch-callout:none] md:hidden"
        aria-label={t("patientChart.quickActionsAria")}
      >
        <Button
          size="lg"
          onClick={handleComplete}
          className="h-13 w-full"
          aria-label={t("patientChart.completeSessionAria")}
        >
          <CheckCircle2 className="size-5" aria-hidden />
          {completeLabel}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={onIssueInvoice}
            className="h-12"
            aria-label={
              hasDebt ? t("patientChart.issueInvoiceDebtAria", { detail: debtLabel ?? "" }) : t("patientChart.issueInvoiceAria")
            }
          >
            <Receipt className="size-5" aria-hidden />
            {t("patientChart.issueInvoice")}
            {debtTag}
          </Button>
          <Button
            variant="outline"
            onClick={openScheduleNext}
            className="h-12"
            aria-label={t("patientChart.scheduleNextAria")}
          >
            <Calendar className="size-5" aria-hidden />
            {t("patientChart.scheduleNext")}
          </Button>
        </div>
      </div>
    </>
  )
}
