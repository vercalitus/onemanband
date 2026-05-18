"use client"

import { AlertTriangle, BellRing, FilePlus, RefreshCcw } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { BalanceBadge } from "@/features/finances/components/balance-badge"
import { PatientNameLink } from "@/features/finances/components/patient-name-link"
import { localeToBcp47 } from "@/lib/format-locale"
import { cn } from "@/lib/utils"
import type { BillingInvoice, UninvoicedVisit } from "@/types/domain"
import type { Locale } from "@/lib/i18n/types"

/**
 * Pending list combines two row types:
 *   1) Uninvoiced visit  → CTA "Generate Invoice"
 *   2) Issued / overdue invoice → CTA "Send Reminder" (+ "Mark Paid" secondary)
 *
 * Wrapped in one component so the Pending tab stays a single visual list.
 */
export function PendingVisitRow({
  visit,
  patientBalance,
  onGenerate,
}: {
  visit: UninvoicedVisit
  patientBalance: number
  onGenerate: () => void
}) {
  const { locale, t } = useLocale()
  const treatmentLabel = t(`billing.treatment.${visit.treatmentType}`)

  return (
    <Row
      tone="action"
      patientId={visit.patientId}
      patientName={visit.patientName}
      subtitle={`${treatmentLabel} · ${t("finances.pending.visitWord")} ${formatVisitDate(visit.visitDate, locale)}`}
      amountLabel={t("finances.pending.suggested")}
      amount={visit.suggestedDisplayAmount}
      balance={patientBalance}
      meta={<span className="text-amber-600">{t("finances.pending.needsInvoice")}</span>}
      action={
        <button
          type="button"
          onClick={onGenerate}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5",
            "text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-700",
          )}
        >
          <FilePlus className="size-3.5 stroke-[2]" aria-hidden />
          {t("finances.pending.generate")}
        </button>
      }
    />
  )
}

export function PendingInvoiceRow({
  invoice,
  patientBalance,
  onSendReminder,
  onMarkPaid,
}: {
  invoice: BillingInvoice
  patientBalance: number
  onSendReminder: () => void
  onMarkPaid: () => void
}) {
  const { t, formatRelative } = useLocale()
  const overdue = invoice.status === "overdue"
  const treatmentLabel = t(`billing.treatment.${invoice.treatmentType}`)
  return (
    <Row
      tone={overdue ? "warning" : "neutral"}
      patientId={invoice.patientId}
      patientName={invoice.patientName}
      subtitle={`${invoice.id} · ${treatmentLabel} · ${t("finances.pending.issued")} ${formatRelative(toIso(invoice.issuedAt))}`}
      amountLabel={overdue ? t("finances.pending.overdueLabel") : t("finances.pending.pendingLabel")}
      amount={invoice.displayAmount}
      balance={patientBalance}
      meta={
        overdue ? (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="size-3 stroke-[2.2]" aria-hidden />
            {t("finances.pending.pastDue")}
          </span>
        ) : invoice.syncStatus === "failed" ? (
          <span className="inline-flex items-center gap-1 text-rose-600">
            <RefreshCcw className="size-3 stroke-[2.2]" aria-hidden />
            {t("finances.pending.syncFailed")}
          </span>
        ) : (
          <span className="text-slate-400">{t("finances.pending.awaiting")}</span>
        )
      }
      action={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onMarkPaid}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5",
              "text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {t("finances.pending.markPaid")}
          </button>
          <button
            type="button"
            onClick={onSendReminder}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5",
              "text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800",
            )}
          >
            <BellRing className="size-3.5 stroke-[2]" aria-hidden />
            {t("finances.pending.sendReminder")}
          </button>
        </div>
      }
    />
  )
}

function Row({
  tone,
  patientId,
  patientName,
  subtitle,
  amountLabel,
  amount,
  balance,
  meta,
  action,
}: {
  tone: "neutral" | "warning" | "action"
  patientId: string
  patientName: string
  subtitle: string
  amountLabel: string
  amount: string
  balance: number
  meta: React.ReactNode
  action: React.ReactNode
}) {
  const indicatorTone =
    tone === "warning" ? "bg-amber-400" : tone === "action" ? "bg-sky-400" : "bg-slate-300"
  return (
    <div
      className={cn(
        "group flex flex-wrap items-center gap-4 rounded-xl bg-white px-4 py-3.5",
        "shadow-[0_1px_4px_-2px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]",
      )}
    >
      <span className={cn("h-9 w-0.5 shrink-0 rounded-full", indicatorTone)} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <PatientNameLink
            patientId={patientId}
            className="truncate text-sm font-bold no-underline hover:underline"
          >
            {patientName}
          </PatientNameLink>
          <BalanceBadge balance={balance} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end text-end">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {amountLabel}
        </p>
        <p className="font-mono text-base font-semibold tabular-nums text-slate-900">{amount}</p>
        <p className="mt-0.5 text-[11px]">{meta}</p>
      </div>

      <div className="flex w-full shrink-0 justify-end sm:w-auto">{action}</div>
    </div>
  )
}

function toIso(value: string | null): string {
  if (!value) return new Date().toISOString()
  return value.length === 10 ? `${value}T00:00:00Z` : value
}

function formatVisitDate(iso: string, locale: Locale): string {
  try {
    const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
    return new Intl.DateTimeFormat(localeToBcp47(locale), { day: "numeric", month: "short" }).format(
      d,
    )
  } catch {
    return iso
  }
}
