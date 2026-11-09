"use client"

import { invoiceReference } from "@/features/finances/lib/invoice-reference"
import { AlertTriangle, Loader2, RefreshCcw } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { StateMark } from "@/components/ui/state-mark"
import { PatientNameLink } from "@/features/finances/components/patient-name-link"
import { ROW_BUTTON } from "@/features/finances/components/pending-row"
import type { BillingInvoice, ProviderIntegration } from "@/types/domain"

/**
 * Billing sidebar: confirms which invoicing provider we're linked to (name +
 * connected state). Timestamps like “last sync / auto sync” stay out of this
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
  const { t } = useLocale()
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 py-1">
        <p className="text-sm text-mute">{t("settings.integrations.providerLabel")}</p>
        <p className="truncate text-[17px] font-bold text-ink">{integration.provider}</p>
        {/* Three states, not two. "Drafts only" is a real connection that
            files real calls and produces no numbered document — reading
            "Connected" there is how a practitioner takes payment believing a
            receipt exists. Drawn as done / not confirmed / struck. */}
        <p className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
          <StateMark
            state={integration.connected ? "done" : integration.draftsOnly ? "unsure" : "cancel"}
          />
          {integration.connected
            ? t("settings.integrations.connected")
            : integration.draftsOnly
              ? t("settings.integrations.draftsOnly")
              : t("finances.integration.disconnected")}
        </p>
      </div>

      {failedInvoices.length > 0 ? (
        <div className="mt-4 border-t border-hair pt-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 stroke-[2] text-ink" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold text-ink">
                {t("finances.integration.failed", { count: failedInvoices.length })}
              </p>
              <p className="mt-0.5 text-sm text-mute">
                {t("finances.integration.retryHint", { provider: integration.provider })}
              </p>
            </div>
          </div>

          <ul className="mt-2">
            {failedInvoices.map((inv) => (
              <li
                key={inv.id}
                className="flex min-h-14 items-center justify-between gap-3 border-b border-hair-soft py-1.5 last:border-b-0"
              >
                <div className="min-w-0 truncate text-sm">
                  {invoiceReference(inv) && (
                    <>
                      <span className="font-medium tabular-nums text-ink">
                        {invoiceReference(inv)}
                      </span>
                      <span className="mx-1.5 text-faint" aria-hidden>
                        ·
                      </span>
                    </>
                  )}
                  <PatientNameLink patientId={inv.patientId} className="font-medium no-underline hover:underline">
                    {inv.patientName}
                  </PatientNameLink>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={ROW_BUTTON}
                  onClick={() => onRetrySync(inv.id)}
                  disabled={inv.syncStatus === "pending"}
                >
                  {inv.syncStatus === "pending" ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <RefreshCcw aria-hidden />
                  )}
                  {inv.syncStatus === "pending"
                    ? t("finances.integration.retrying")
                    : t("finances.integration.retry")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
