"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
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
import { StateMark } from "@/components/ui/state-mark"
import { clinicIsoDate, DEFAULT_CLINIC_TIMEZONE } from "@/features/automations/lib/clinic-time"
import { cn } from "@/lib/utils"
import type { BillingInvoice, PaymentMethod } from "@/types/domain"

/**
 * Recording payment is the moment the tax document gets filed, so the two are
 * one action rather than two. A receipt has to say how the money arrived,
 * which is why the method is asked for here and not inferred.
 */

const METHODS: PaymentMethod[] = [
  "cash",
  "digital",
  "credit_card",
  "bank_transfer",
  "cheque",
]

export interface SettleOutcome {
  ok: boolean
  /** Already localised by the caller — this component only displays it. */
  message: string
  /** Blocked filings need a human to check the bookkeeping system. */
  blocked?: boolean
}

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onConfirm,
}: {
  invoice: BillingInvoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payment: {
    amount: number
    method: PaymentMethod
    date: string
  }) => Promise<SettleOutcome>
}) {
  const { t, formatMoney } = useLocale()
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [amount, setAmount] = useState("")
  // The clinic's own calendar day decides the document date — not the
  // viewer's, who may be filling this in from another timezone.
  const [date, setDate] = useState(() => clinicIsoDate(new Date(), DEFAULT_CLINIC_TIMEZONE))
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<SettleOutcome | null>(null)

  const invoiceId = invoice?.id ?? null
  const invoiceAmount = invoice?.amount ?? 0

  // Keyed on the invoice *id*, not the object: settling replaces the invoice
  // in the list, and re-running on identity would wipe the result the
  // practitioner still needs to read.
  useEffect(() => {
    if (!open || !invoiceId) return
    setMethod("cash")
    setAmount(String(invoiceAmount))
    setDate(clinicIsoDate(new Date(), DEFAULT_CLINIC_TIMEZONE))
    setOutcome(null)
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- amount is the seed value, not a dependency
  }, [open, invoiceId])

  if (!invoice) return null

  const parsedAmount = Number(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0

  const submit = async () => {
    if (!amountValid || busy) return
    setBusy(true)
    const result = await onConfirm({ amount: parsedAmount, method, date })
    setOutcome(result)
    setBusy(false)
    if (result.ok) window.setTimeout(() => onOpenChange(false), 1600)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-10 text-[22px] leading-tight font-bold text-ink">
            {t("billing.payment.title")}
          </DialogTitle>
          <DialogDescription className="text-[17px] leading-snug text-mute">
            {t("billing.payment.description", {
              patientName: invoice.patientName,
              amount: formatMoney(invoice.amount),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium text-mute"
              htmlFor="payment-amount"
            >
              {t("billing.payment.amountLabel")}
            </label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-44 font-display text-[22px] tabular-nums"
            />
            <p className="text-sm text-mute">{t("billing.payment.vatNote")}</p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-mute">
              {t("billing.payment.methodLabel")}
            </span>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
                    method === m
                      ? "border-cobalt bg-cobalt font-bold text-white"
                      : "border-hair bg-paper text-ink hover:bg-ground",
                  )}
                >
                  {t(`billing.payment.method.${m}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium text-mute"
              htmlFor="payment-date"
            >
              {t("billing.payment.dateLabel")}
            </label>
            <Input
              id="payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-52 tabular-nums"
            />
          </div>

          {outcome && (
            <p
              role={outcome.ok ? "status" : "alert"}
              className={cn(
                "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[17px] leading-snug font-medium text-ink",
                outcome.ok ? "border-olive/40 bg-olive-tint" : "border-ink/30 bg-sunk",
              )}
            >
              {outcome.ok ? (
                <StateMark state="done" className="mt-1.5" />
              ) : (
                <AlertTriangle className="mt-1 size-4 shrink-0 stroke-[2]" aria-hidden />
              )}
              {outcome.message}
            </p>
          )}
        </div>

        <DialogFooter className="-mx-6 -mb-6 rounded-b-md border-hair bg-paper px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!amountValid || busy} className="h-12 gap-2 px-5">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("billing.payment.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
