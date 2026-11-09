"use client"

import { AlertTriangle, CalendarClock, CalendarPlus, Check, Loader2, Receipt, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StateMark } from "@/components/ui/state-mark"
import { cn } from "@/lib/utils"
import type { CloseSessionOutcome } from "@/features/patients/lib/use-close-session"
import type { PaymentMethod, ScheduleItem } from "@/types/domain"

/**
 * The last thing that happens at a visit.
 *
 * It replaces a two-tap confirmation that asked nothing, because closing a
 * session turned out to be three decisions rather than one — and two of them
 * were being made on other screens, days later, or not at all.
 *
 * What it does and does not ask is the whole design:
 *
 *  - **The next visit is not a question.** The diary knows. Asking would let
 *    somebody tick "booked" for a time that does not exist.
 *  - **Payment is a question**, and only because it has to be: the money
 *    arrives by Bit on the practitioner's own phone, and nothing about that
 *    reaches this app. The method is asked with it because a חשבונית מס קבלה
 *    has to say how the money came in.
 *  - **The amount is editable.** It starts at the price of this treatment type
 *    and what is typed here is what gets billed, chased and receipted — a visit
 *    that ran short, a favour, a course rate.
 *  - **Earlier debt is shown, not collected.** A receipt belongs to one
 *    invoice; settling three visits at once means three documents, and that is
 *    a decision to make on the Finances page with them all in view.
 */

/** Two sessions for one patient closer together than this are asked about. */
const RECENT_SESSION_MINUTES = 30

const METHODS: PaymentMethod[] = ["digital", "cash", "credit_card", "bank_transfer", "cheque"]

export function SessionCloseDialog({
  open,
  onOpenChange,
  sessionNumber,
  patientName,
  contents,
  nextAppointment,
  defaultAmount,
  outstandingDebt,
  onScheduleNext,
  onConfirm,
  sessionIsEmpty,
  lastRecordedAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionNumber: number
  /** Shown above the session number; the sheet is about one person. */
  patientName?: string
  /** What the session being closed holds, listed as what goes into the record. */
  contents?: { drawing: boolean; notes: boolean; audio: boolean }
  /** The patient's next booking, or null when they are leaving without one. */
  nextAppointment: ScheduleItem | null
  /** List price for this treatment type — the starting point, not the answer. */
  defaultAmount: number
  /** Unpaid visits from before today. Shown; never settled from here. */
  outstandingDebt: number
  onScheduleNext: () => void
  /** Nothing typed, drawn or recorded in the session being closed. */
  sessionIsEmpty: boolean
  /** When this patient's most recent session that counts was recorded. */
  lastRecordedAt: string | null
  onConfirm: (input: {
    amount: number
    paid: boolean
    method: PaymentMethod
  }) => Promise<CloseSessionOutcome | null>
}) {
  const { t, localeTag, formatMoney } = useLocale()
  const [amount, setAmount] = useState(String(defaultAmount))
  const [paid, setPaid] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>("digital")
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<CloseSessionOutcome | null>(null)
  /**
   * A record is only made when there is a visit to record.
   *
   * Closing a session writes a treatment row that can never be deleted and
   * counts against the care plan. It used to be written for every press of the
   * button: after the first close the card was empty and the button still
   * live, so each further press — to check it had saved, or because nothing
   * seemed to happen — wrote another, empty, session. A patient on a plan of
   * eight read eleven, five of them blank.
   *
   * Two cases now need saying so, out loud, before anything is written: a
   * session with nothing in it, and a second session for the same patient
   * within half an hour of the last one. Both can be real — a visit where
   * nothing needed writing down, two treatments in a day — so they are asked,
   * not refused.
   */
  const [minutesSinceLast, setMinutesSinceLast] = useState<number | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  /** Taken synchronously, so a second tap in the same instant is not a second record. */
  const inFlight = useRef(false)

  /**
   * Reset on opening, and only on opening.
   *
   * Every input here is seeded from something that changes the moment the
   * session closes — the visit's own price, the diary. Reacting to that while
   * the sheet is still up wiped the result the practitioner had not read yet,
   * and put the empty form back over it.
   */
  useEffect(() => {
    if (!open) return
    setAmount(String(defaultAmount))
    setPaid(true)
    setMethod("digital")
    setBusy(false)
    setOutcome(null)
    setAcknowledged(false)
    inFlight.current = false
    setMinutesSinceLast(
      lastRecordedAt
        ? Math.floor((Date.now() - new Date(lastRecordedAt).getTime()) / 60_000)
        : null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the amount is the seed at open, not a dependency
  }, [open])

  const parsed = Number(amount)
  const amountValid = Number.isFinite(parsed) && parsed >= 0

  const recentlyRecorded =
    minutesSinceLast !== null && minutesSinceLast >= 0 && minutesSinceLast < RECENT_SESSION_MINUTES
  const needsAcknowledgement = sessionIsEmpty || recentlyRecorded

  const submit = async () => {
    if (!amountValid || busy || inFlight.current) return
    if (needsAcknowledgement && !acknowledged) return
    inFlight.current = true
    setBusy(true)
    const result = await onConfirm({ amount: parsed, paid, method })
    setBusy(false)
    if (!result) {
      // Nothing was written: the practitioner may try again.
      inFlight.current = false
      return
    }
    setOutcome(result)
    // Long enough to read what happened to the document and the booking link.
    window.setTimeout(() => onOpenChange(false), result.billingFailed ? 4000 : 2400)
  }

  const when = nextAppointment
    ? `${new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(
        new Date(`${nextAppointment.date}T00:00:00`),
      )} · ${nextAppointment.start}`
    : null

  const recordItems = contents
    ? [
        { key: "drawing", on: contents.drawing, yes: "patientChart.close.rec.drawing", no: "patientChart.close.rec.noDrawing" },
        { key: "notes", on: contents.notes, yes: "patientChart.close.rec.notes", no: "patientChart.close.rec.noNotes" },
        { key: "audio", on: contents.audio, yes: "patientChart.close.rec.audio", no: "patientChart.close.rec.noAudio" },
      ]
    : null

  return (
    <Dialog open={open} onOpenChange={busy ? () => {} : onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        {/* The dialog's own plate: which session this is, in display type. */}
        <DialogHeader className="on-cobalt flex min-h-24 flex-row items-center gap-5 bg-cobalt px-6 py-3 text-start text-white">
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">
              {patientName
                ? t("patientChart.close.heading", { name: patientName })
                : t("patientChart.close.title")}
            </p>
            <DialogTitle className="mt-0.5 font-display text-[40px] leading-[0.95] font-normal text-white tabular-nums sm:text-[56px]">
              {t("patientChart.close.sessionN", { n: sessionNumber })}
            </DialogTitle>
          </div>
          <span className="hidden w-px self-stretch bg-white/25 sm:block" aria-hidden />
          <DialogDescription className="hidden max-w-[200px] text-sm leading-snug text-white/80 sm:block">
            {t("patientChart.close.order")}
          </DialogDescription>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="ms-auto border-white/25 bg-transparent text-white hover:bg-white/10 focus-visible:outline-white"
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </DialogHeader>

        {outcome ? (
          <div className="grid divide-y divide-hair-soft px-6 py-2 text-[17px] text-ink">
            {outcome.billingMessage && (
              <p className="flex min-h-12 items-start gap-3 py-3">
                {outcome.billingFailed ? (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                ) : (
                  <Check className="mt-0.5 size-5 shrink-0 text-olive" aria-hidden />
                )}
                {outcome.billingMessage}
              </p>
            )}
            {/* A visit left owing has to say so. Without this the sheet closed
                on an empty panel, which reads as "nothing happened" — for the
                one outcome where something is owed and someone will be
                chased. */}
            {outcome.chargeLeftOpen && (
              <p className="flex min-h-12 items-start gap-3 py-3">
                <Receipt className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                {t("patientChart.close.chargeOpen", { amount: formatMoney(parsed) })}
              </p>
            )}
            {outcome.invitedToBook && (
              <p className="flex min-h-12 items-start gap-3 py-3">
                <CalendarClock className="mt-0.5 size-5 shrink-0 text-cobalt" aria-hidden />
                {t("patientChart.close.invited")}
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto">
            {/* What this visit leaves behind. */}
            <section className="border-b border-hair-soft px-6 py-5">
              <h2 className="mb-2.5 text-[17px] font-bold text-ink">
                {t("patientChart.close.recordTitle")}
              </h2>
              {recordItems && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {recordItems.map((item) =>
                    item.on ? (
                      <span
                        key={item.key}
                        className="flex min-h-11 items-center gap-2 rounded-[4px] bg-olive-tint px-3 text-sm font-medium text-ink"
                      >
                        <Check className="size-4 shrink-0 text-olive" aria-hidden />
                        {t(item.yes)}
                      </span>
                    ) : (
                      <span
                        key={item.key}
                        className="flex min-h-11 items-center rounded-[4px] border border-dashed border-hair px-3 text-sm text-mute"
                      >
                        {t(item.no)}
                      </span>
                    ),
                  )}
                </div>
              )}

              {needsAcknowledgement && (
                <button
                  type="button"
                  onClick={() => setAcknowledged((v) => !v)}
                  aria-pressed={acknowledged}
                  className={cn(
                    "mt-3 flex w-full items-start gap-3 rounded-md border-2 px-3 py-3 text-start transition-colors",
                    acknowledged ? "border-cobalt bg-cobalt-tint" : "border-signal bg-paper hover:bg-ground",
                  )}
                >
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                  <span className="min-w-0 flex-1">
                    {recentlyRecorded && (
                      <span className="block text-[17px] leading-snug font-bold text-ink">
                        {t("patientChart.close.recentWarning", { n: minutesSinceLast ?? 0 })}
                      </span>
                    )}
                    {sessionIsEmpty && (
                      <span className="block text-[17px] leading-snug font-bold text-ink">
                        {t("patientChart.close.emptyWarning")}
                      </span>
                    )}
                    <span className="mt-2 flex min-h-6 items-center gap-2.5 text-sm font-medium text-ink">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-[4px] border-2",
                          acknowledged ? "border-cobalt bg-cobalt" : "border-ink/40 bg-paper",
                        )}
                      >
                        {acknowledged && <Check className="size-4 text-white" aria-hidden />}
                      </span>
                      {t("patientChart.close.recordAnyway")}
                    </span>
                  </span>
                </button>
              )}
            </section>

            {/* The charge for this visit, at whatever it actually was. */}
            <section className="border-b border-hair-soft px-6 py-5">
              <h2 className="mb-2.5 text-[17px] font-bold text-ink">
                <label htmlFor="close-amount">{t("patientChart.close.chargeLabel")}</label>
              </h2>
              <div className="grid items-start gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                <div className="flex h-[76px] items-center gap-1.5 rounded-md border-2 border-ink px-4 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-cobalt">
                  <span className="text-[22px] font-bold text-mute" aria-hidden>
                    ₪
                  </span>
                  <input
                    id="close-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    dir="ltr"
                    aria-invalid={!amountValid || undefined}
                    className="w-full min-w-0 border-0 bg-transparent p-0 font-display text-[48px] leading-none tabular-nums text-ink outline-none"
                  />
                </div>

                {/* The one thing the app cannot know. */}
                <div>
                  <div
                    role="group"
                    aria-label={t("patientChart.close.paymentAria")}
                    className="flex gap-0.5 rounded-md border border-hair bg-paper p-[3px]"
                  >
                    {([true, false] as const).map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setPaid(value)}
                        aria-pressed={paid === value}
                        className={cn(
                          "min-h-12 flex-1 rounded-[4px] px-3 text-[17px] font-medium transition-colors",
                          paid === value ? "bg-cobalt font-bold text-white" : "text-mute hover:bg-ground",
                        )}
                      >
                        {value ? t("patientChart.close.paid") : t("patientChart.close.notYet")}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-snug text-mute">
                    {paid ? t("patientChart.close.paidHint") : t("patientChart.close.unpaidHint")}
                  </p>
                </div>
              </div>

              {paid && (
                <div
                  role="group"
                  aria-label={t("patientChart.close.methodAria")}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      aria-pressed={method === m}
                      className={cn(
                        "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors",
                        method === m
                          ? "border-cobalt bg-cobalt font-bold text-white"
                          : "border-hair bg-paper text-ink hover:bg-ground",
                      )}
                    >
                      {t(`billing.payment.method.${m}`)}
                    </button>
                  ))}
                </div>
              )}

              {outstandingDebt > 0 && (
                <p className="mt-3 text-sm leading-snug text-mute">
                  {t("patientChart.close.previousDebt", {
                    amount: formatMoney(outstandingDebt),
                  })}
                </p>
              )}
            </section>

            {/* What the diary already knows. Never a question. */}
            <section className="flex items-center gap-4 px-6 py-5">
              <StateMark state={nextAppointment ? "plan" : "unsure"} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-ink">
                  {nextAppointment
                    ? t("patientChart.close.nextBooked", { when: when ?? "" })
                    : t("patientChart.close.nextNone")}
                </p>
                {!nextAppointment && (
                  <p className="mt-0.5 text-sm leading-snug text-mute">
                    {t("patientChart.close.nextNoneHint")}
                  </p>
                )}
              </div>
              {!nextAppointment && (
                <Button variant="outline" onClick={onScheduleNext} className="shrink-0 text-sm">
                  <CalendarPlus aria-hidden />
                  {t("patientChart.close.scheduleNow")}
                </Button>
              )}
            </section>
          </div>
        )}

        {!outcome && (
          <DialogFooter className="m-0 flex-row justify-end gap-2 rounded-none border-t border-hair bg-ground px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              size="lg"
              onClick={submit}
              disabled={!amountValid || busy || (needsAcknowledgement && !acknowledged)}
              className="gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("patientChart.close.confirm")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
