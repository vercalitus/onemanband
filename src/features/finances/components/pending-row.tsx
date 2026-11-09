"use client"

import { invoiceReference, joinSubtitle } from "@/features/finances/lib/invoice-reference"
import { BellRing, FilePlus, RefreshCcw } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { StateMark, type MarkState } from "@/components/ui/state-mark"
import { BalanceBadge } from "@/features/finances/components/balance-badge"
import { PatientNameLink } from "@/features/finances/components/patient-name-link"
import { localeToBcp47 } from "@/lib/format-locale"
import { cn } from "@/lib/utils"
import type { BillingInvoice, UninvoicedVisit } from "@/types/domain"
import type { Locale } from "@/lib/i18n/types"

/** A row's one button: 44px, 14px, paper and hairline (the mockups' `.btn.sm`). */
export const ROW_BUTTON = "h-11 gap-1.5 px-3 text-sm"

/**
 * Pending list combines two row types:
 *   1) Uninvoiced visit  → CTA "Generate Invoice"
 *   2) Issued / overdue invoice → CTA "Mark Paid" (+ "Send Reminder" as an icon)
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
      mark="plan"
      patientId={visit.patientId}
      patientName={visit.patientName}
      subtitle={`${treatmentLabel} · ${t("finances.pending.visitWord")} ${formatVisitDate(visit.visitDate, locale)}`}
      // Not yet a debt — no charge has been raised — so the amount is plain,
      // labelled as the price list's suggestion rather than outlined as owed.
      amount={<span className="text-[17px] font-bold tabular-nums text-ink">{visit.suggestedDisplayAmount}</span>}
      meta={
        <>
          {t("finances.pending.suggested")} · {t("finances.pending.needsInvoice")}
        </>
      }
      balance={patientBalance}
      action={
        <Button type="button" variant="outline" className={ROW_BUTTON} onClick={onGenerate}>
          <FilePlus aria-hidden />
          {t("finances.pending.generate")}
        </Button>
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
      mark="plan"
      patientId={invoice.patientId}
      patientName={invoice.patientName}
      subtitle={joinSubtitle([
        invoiceReference(invoice),
        treatmentLabel,
        `${t("finances.pending.issued")} ${formatRelative(toIso(invoice.issuedAt))}`,
      ])}
      amount={<OwedTag>{invoice.displayAmount}</OwedTag>}
      meta={
        overdue ? (
          <span className="font-medium text-ink">{t("finances.pending.overdueLabel")}</span>
        ) : invoice.syncStatus === "failed" ? (
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            <RefreshCcw className="size-3.5 stroke-[2]" aria-hidden />
            {t("finances.pending.syncFailed")}
          </span>
        ) : (
          t("finances.pending.awaiting")
        )
      }
      balance={patientBalance}
      action={
        <div className="flex items-center gap-2">
          {/* The row's one labelled action is the payment. The reminder is a
              second, lesser verb — it stays reachable, as an icon. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onSendReminder}
            aria-label={t("finances.pending.sendReminder")}
            title={t("finances.pending.sendReminder")}
          >
            <BellRing aria-hidden />
          </Button>
          <Button type="button" variant="outline" className={ROW_BUTTON} onClick={onMarkPaid}>
            {t("finances.pending.markPaid")}
          </Button>
        </div>
      }
    />
  )
}

/** An amount still owed: the small orange outline from the dashboard. */
export function OwedTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-[4px] border-[1.5px] border-signal px-2 text-[17px] font-bold whitespace-nowrap tabular-nums text-ink",
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * One hairline row on paper: state mark · who · amount · the action. Below
 * `sm` the action drops to its own line rather than crushing the name.
 */
export function Row({
  mark,
  patientId,
  patientName,
  subtitle,
  amount,
  meta,
  balance,
  action,
  muted,
}: {
  mark: MarkState
  patientId: string
  patientName: string
  subtitle: string
  amount: React.ReactNode
  meta: React.ReactNode
  balance?: number
  action?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        "grid min-h-[72px] grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 border-b border-hair-soft px-4 py-3 last:border-b-0 sm:px-6",
        action && "sm:grid-cols-[12px_minmax(0,1fr)_auto_auto] sm:gap-x-5",
      )}
    >
      <StateMark state={mark} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <PatientNameLink
            patientId={patientId}
            className={cn(
              "truncate text-[17px] font-bold no-underline hover:underline",
              muted && "font-medium text-mute line-through decoration-1",
            )}
          >
            {patientName}
          </PatientNameLink>
          {balance !== undefined && <BalanceBadge balance={balance} />}
        </div>
        <p className="mt-0.5 truncate text-sm text-mute">{subtitle}</p>
      </div>

      <div className="flex flex-col items-end gap-1 text-end">
        {amount}
        <span className="text-sm text-mute">{meta}</span>
      </div>

      {action && (
        <div className="col-span-full flex justify-end sm:col-span-1">{action}</div>
      )}
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
