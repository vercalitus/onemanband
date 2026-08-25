"use client"

import { AlertTriangle, CheckCircle2, Loader2, Receipt } from "lucide-react"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4 stroke-[1.8] text-sky-600" aria-hidden />
            {t("billing.payment.title")}
          </DialogTitle>
          <DialogDescription>
            {t("billing.payment.description", {
              patientName: invoice.patientName,
              amount: formatMoney(invoice.amount),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              htmlFor="payment-amount"
            >
              {t("billing.payment.amountLabel")}
            </label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-40 rounded-xl font-mono tabular-nums"
            />
            <p className="text-[11px] text-slate-500">{t("billing.payment.vatNote")}</p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("billing.payment.methodLabel")}
            </span>
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
          </div>

          <div className="grid gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              htmlFor="payment-date"
            >
              {t("billing.payment.dateLabel")}
            </label>
            <Input
              id="payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-48 rounded-xl"
            />
          </div>

          {outcome && (
            <p
              className={cn(
                "flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
                outcome.ok
                  ? "bg-emerald-50 text-emerald-800"
                  : outcome.blocked
                    ? "bg-amber-50 text-amber-800"
                    : "bg-rose-50 text-rose-800",
              )}
            >
              {outcome.ok ? (
                <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
              ) : (
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              )}
              {outcome.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!amountValid || busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("billing.payment.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
