"use client"

import { AlertTriangle, CalendarClock, CalendarPlus, Check, Loader2, Receipt } from "lucide-react"
import { useEffect, useState } from "react"

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
import { Input } from "@/components/ui/input"
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

const METHODS: PaymentMethod[] = ["digital", "cash", "credit_card", "bank_transfer", "cheque"]

export function SessionCloseDialog({
  open,
  onOpenChange,
  sessionNumber,
  nextAppointment,
  defaultAmount,
  outstandingDebt,
  onScheduleNext,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionNumber: number
  /** The patient's next booking, or null when they are leaving without one. */
  nextAppointment: ScheduleItem | null
  /** List price for this treatment type — the starting point, not the answer. */
  defaultAmount: number
  /** Unpaid visits from before today. Shown; never settled from here. */
  outstandingDebt: number
  onScheduleNext: () => void
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the amount is the seed at open, not a dependency
  }, [open])

  const parsed = Number(amount)
  const amountValid = Number.isFinite(parsed) && parsed >= 0

  const submit = async () => {
    if (!amountValid || busy) return
    setBusy(true)
    const result = await onConfirm({ amount: parsed, paid, method })
    setBusy(false)
    if (!result) return
    setOutcome(result)
    // Long enough to read what happened to the document and the booking link.
    window.setTimeout(() => onOpenChange(false), result.billingFailed ? 4000 : 2400)
  }

  const when = nextAppointment
    ? `${new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(
        new Date(`${nextAppointment.date}T00:00:00`),
      )} · ${nextAppointment.start}`
    : null

  return (
    <Dialog open={open} onOpenChange={busy ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="size-4 stroke-[1.8] text-emerald-600" aria-hidden />
            {t("patientChart.close.title")}
          </DialogTitle>
          <DialogDescription>
            {t("patientChart.close.subtitle", { n: sessionNumber })}
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="grid gap-2 py-2">
            {outcome.billingMessage && (
              <p
                className={cn(
                  "flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
                  outcome.billingFailed
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-800",
                )}
              >
                {outcome.billingFailed ? (
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                ) : (
                  <Check className="mt-px size-3.5 shrink-0" aria-hidden />
                )}
                {outcome.billingMessage}
              </p>
            )}
            {/* A visit left owing has to say so. Without this the sheet closed
                on an empty panel, which reads as "nothing happened" — for the
                one outcome where something is owed and someone will be
                chased. */}
            {outcome.chargeLeftOpen && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <Receipt className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("patientChart.close.chargeOpen", { amount: formatMoney(parsed) })}
              </p>
            )}
            {outcome.invitedToBook && (
              <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
                <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("patientChart.close.invited")}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {/* What the diary already knows. Never a question. */}
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl border px-3 py-2.5",
                nextAppointment
                  ? "border-slate-200 bg-slate-50"
                  : "border-sky-200 bg-sky-50/70",
              )}
            >
              <CalendarClock
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  nextAppointment ? "text-slate-400" : "text-sky-600",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700">
                  {nextAppointment
                    ? t("patientChart.close.nextBooked", { when: when ?? "" })
                    : t("patientChart.close.nextNone")}
                </p>
                {!nextAppointment && (
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {t("patientChart.close.nextNoneHint")}
                  </p>
                )}
              </div>
              {!nextAppointment && (
                <button
                  type="button"
                  onClick={onScheduleNext}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                >
                  <CalendarPlus className="size-3" aria-hidden />
                  {t("patientChart.close.scheduleNow")}
                </button>
              )}
            </div>

            {/* The charge for this visit, at whatever it actually was. */}
            <div className="grid gap-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                htmlFor="close-amount"
              >
                {t("patientChart.close.chargeLabel")}
              </label>
              <Input
                id="close-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="max-w-40 rounded-xl font-mono tabular-nums"
              />
              {outstandingDebt > 0 && (
                <p className="text-[11px] text-slate-500">
                  {t("patientChart.close.previousDebt", {
                    amount: formatMoney(outstandingDebt),
                  })}
                </p>
              )}
            </div>

            {/* The one thing the app cannot know. */}
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setPaid((v) => !v)}
                aria-pressed={paid}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors",
                  paid
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border",
                    paid ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white",
                  )}
                >
                  {paid && <Check className="size-3.5 text-white" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">
                    {t("patientChart.close.paid")}
                  </span>
                  <span className="block text-[11px] leading-snug text-slate-500">
                    {paid
                      ? t("patientChart.close.paidHint")
                      : t("patientChart.close.unpaidHint")}
                  </span>
                </span>
              </button>

              {paid && (
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      aria-pressed={method === m}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        method === m
                          ? "border-sky-600 bg-sky-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                      )}
                    >
                      {t(`billing.payment.method.${m}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!outcome && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={!amountValid || busy} className="gap-2">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("patientChart.close.confirm")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
