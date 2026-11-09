"use client"

import { invoiceReference, joinSubtitle } from "@/features/finances/lib/invoice-reference"

import { useLocale } from "@/components/providers/locale-provider"
import { Row } from "@/features/finances/components/pending-row"
import { cn } from "@/lib/utils"
import type { BillingInvoice } from "@/types/domain"

function formatDate(value: string | null, localeTag: string): string {
  if (!value) return "—"
  try {
    const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
    return new Intl.DateTimeFormat(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d)
  } catch {
    return value ?? "—"
  }
}

/**
 * History row — read-only summary of paid / voided invoices. The same hairline
 * row as Pending, without an action: what is settled has nothing left to do.
 */
export function HistoryRow({
  invoice,
  patientBalance,
}: {
  invoice: BillingInvoice
  patientBalance: number
}) {
  const { t, localeTag } = useLocale()
  const isVoid = invoice.status === "void"
  const treatmentKey = `billing.treatment.${invoice.treatmentType}`
  const treatmentTranslated = t(treatmentKey)
  const treatmentLabel =
    treatmentTranslated === treatmentKey ? invoice.treatmentType : treatmentTranslated
  const meta = isVoid
    ? t("finances.history.voidedOn", { date: formatDate(invoice.issuedAt, localeTag) })
    : t("finances.history.paidOn", { date: formatDate(invoice.paidAt, localeTag) })

  return (
    <Row
      mark={isVoid ? "cancel" : "done"}
      muted={isVoid}
      patientId={invoice.patientId}
      patientName={invoice.patientName}
      subtitle={joinSubtitle([invoiceReference(invoice), treatmentLabel, meta])}
      balance={patientBalance}
      amount={
        <span
          className={cn(
            "text-[17px] font-bold tabular-nums text-ink",
            isVoid && "font-medium text-mute line-through decoration-1",
          )}
        >
          {invoice.displayAmount}
        </span>
      }
      meta={
        <span className={cn(!isVoid && "font-medium text-olive")}>
          {isVoid ? t("history.status.void") : t("history.status.paid")}
        </span>
      }
    />
  )
}
