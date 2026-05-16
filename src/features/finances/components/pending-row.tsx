"use client"

import { AlertTriangle, BellRing, FilePlus, RefreshCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelative } from "@/features/finances/lib/derive-billing"
import { BalanceBadge } from "@/features/finances/components/balance-badge"
import type { BillingInvoice, UninvoicedVisit } from "@/types/domain"

const TREATMENT_LABEL: Record<string, string> = {
  first: "First Visit",
  adjustments: "Adjustments",
  kupa: "Kupa",
}

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
  return (
    <Row
      tone="action"
      title={visit.patientName}
      subtitle={`${TREATMENT_LABEL[visit.treatmentType]} · Visit ${formatVisitDate(visit.visitDate)}`}
      amountLabel="Suggested"
      amount={visit.suggestedDisplayAmount}
      balance={patientBalance}
      meta={<span className="text-amber-600">Needs invoice</span>}
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
          Generate Invoice
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
  const overdue = invoice.status === "overdue"
  return (
    <Row
      tone={overdue ? "warning" : "neutral"}
      title={invoice.patientName}
      subtitle={`${invoice.id} · ${TREATMENT_LABEL[invoice.treatmentType]} · Issued ${formatRelative(toIso(invoice.issuedAt))}`}
      amountLabel={overdue ? "Overdue" : "Pending"}
      amount={invoice.displayAmount}
      balance={patientBalance}
      meta={
        overdue ? (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="size-3 stroke-[2.2]" aria-hidden />
            Past due
          </span>
        ) : invoice.syncStatus === "failed" ? (
          <span className="inline-flex items-center gap-1 text-rose-600">
            <RefreshCcw className="size-3 stroke-[2.2]" aria-hidden />
            Sync failed
          </span>
        ) : (
          <span className="text-slate-400">Awaiting payment</span>
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
            Mark paid
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
            Send Reminder
          </button>
        </div>
      }
    />
  )
}

function Row({
  tone,
  title,
  subtitle,
  amountLabel,
  amount,
  balance,
  meta,
  action,
}: {
  tone: "neutral" | "warning" | "action"
  title: string
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
          <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          <BalanceBadge balance={balance} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end text-right">
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

function formatVisitDate(iso: string): string {
  try {
    const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(d)
  } catch {
    return iso
  }
}
