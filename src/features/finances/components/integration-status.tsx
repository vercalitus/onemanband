"use client"

import { AlertTriangle, Loader2, RefreshCcw } from "lucide-react"

import { PatientNameLink } from "@/features/finances/components/patient-name-link"
import { cn } from "@/lib/utils"
import type { BillingInvoice, ProviderIntegration } from "@/types/domain"

/**
 * Billing sidebar: confirms which invoicing provider we're linked to (name +
 * connected chip). Timestamps like “last sync / auto sync” stay out of this
 * UI by design — only actionable failures render below.
 */
export function IntegrationStatus({
  integration,
  failedInvoices,
  onRetrySync,
}: {
  integration: ProviderIntegration
  failedInvoices: BillingInvoice[]
  onRetrySync: (invoiceId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Invoicing provider
            </p>
            <p className="mt-1 truncate text-base font-bold text-slate-900">{integration.provider}</p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              integration.connected
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                integration.connected ? "bg-emerald-500" : "bg-rose-500",
              )}
              aria-hidden
            />
            {integration.connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {failedInvoices.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-[0_2px_10px_-6px_rgba(217,119,6,0.18)]">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="size-3.5 stroke-[2]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {failedInvoices.length === 1
                  ? "1 invoice failed to sync"
                  : `${failedInvoices.length} invoices failed to sync`}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700/90">
                Retry to push them to {integration.provider} again.
              </p>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5">
            {failedInvoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5"
              >
                <div className="min-w-0 truncate text-xs">
                  <span className="font-mono font-semibold tabular-nums text-slate-900">{inv.id}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="text-slate-600">
                    <PatientNameLink patientId={inv.patientId} className="font-medium no-underline hover:underline">
                      {inv.patientName}
                    </PatientNameLink>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRetrySync(inv.id)}
                  disabled={inv.syncStatus === "pending"}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                    inv.syncStatus === "pending"
                      ? "cursor-wait text-slate-400"
                      : "text-amber-800 hover:bg-amber-100",
                  )}
                >
                  {inv.syncStatus === "pending" ? (
                    <Loader2 className="size-3 animate-spin stroke-[2.2]" aria-hidden />
                  ) : (
                    <RefreshCcw className="size-3 stroke-[2.2]" aria-hidden />
                  )}
                  {inv.syncStatus === "pending" ? "Retrying" : "Retry"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
