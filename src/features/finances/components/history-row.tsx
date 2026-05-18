"use client"

import { CheckCircle2, Slash } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { BalanceBadge } from "@/features/finances/components/balance-badge"
import { PatientNameLink } from "@/features/finances/components/patient-name-link"
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
 * History row — read-only summary of paid / voided invoices. Same
 * card-style row as Pending for visual rhythm, but without action buttons.
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
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-xl bg-white px-4 py-3",
        "shadow-[0_1px_4px_-2px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]",
        isVoid && "opacity-70",
      )}
    >
      <span
        className={cn("h-9 w-0.5 shrink-0 rounded-full", isVoid ? "bg-slate-300" : "bg-emerald-300")}
        aria-hidden
      />

      <div className="min-w-0 flex-1 text-start">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <PatientNameLink
            patientId={invoice.patientId}
            className="truncate text-sm font-bold no-underline hover:underline"
          >
            {invoice.patientName}
          </PatientNameLink>
          <BalanceBadge balance={patientBalance} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {invoice.id} · {treatmentLabel} · {meta}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-end">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
            isVoid ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700",
          )}
        >
          {isVoid ? (
            <Slash className="size-3 stroke-[2.4]" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3 stroke-[2.4]" aria-hidden />
          )}
          {isVoid ? t("history.status.void") : t("history.status.paid")}
        </span>
        <p
          className={cn(
            "font-mono text-base font-semibold tabular-nums text-slate-900",
            isVoid && "line-through decoration-slate-300",
          )}
        >
          {invoice.displayAmount}
        </p>
      </div>
    </div>
  )
}
