"use client"

import { Link2, Loader2 } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { StateMark } from "@/components/ui/state-mark"
import { CalendarSubscription } from "@/features/settings/components/calendar-subscription"
import {
  SettingsField,
  SettingsSection,
  SettingsSheet,
  StateLine,
  SwitchRow,
  hintClass,
  selectClass,
} from "@/features/settings/components/settings-ui"
import { cn } from "@/lib/utils"
import type { InvoiceProvider } from "@/types/domain"
import type { ClinicSettings } from "@/types/clinic-settings"

const PROVIDERS: InvoiceProvider[] = ["SUMIT", "Green Invoice", "Morning", "Invoice4U"]

/**
 * Providers disagree about whether a VAT rate is `0.18` or `18`, and this is a
 * display-only number, so accept either rather than guess wrong in public.
 */
function formatVatRate(rate: number): number {
  const percent = rate <= 1 ? rate * 100 : rate
  return Math.round(percent * 10) / 10
}

interface PingResponse {
  ok: boolean
  provider: string
  live: boolean
  draftsOnly: boolean
  vatRate: number | null
  message?: string
}

export function IntegrationsTab({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const { integrations } = settings
  const [testing, setTesting] = useState(false)
  const [ping, setPing] = useState<PingResponse | null>(null)

  /**
   * Ask the server whether the bookkeeping credentials actually work.
   *
   * The answer carries the VAT rate the accounting system is applying, which
   * is worth showing: it is the one number in this integration that must never
   * be assumed, and seeing it is how a wrong assumption gets caught before it
   * reaches an invoice.
   */
  const runTest = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/billing/ping", { cache: "no-store" })
      const data = (await res.json()) as PingResponse
      setPing(data)
      onChange({
        ...settings,
        integrations: { ...integrations, billingConnected: data.ok && data.live },
      })
    } catch {
      setPing({
        ok: false,
        provider: "—",
        live: false,
        draftsOnly: true,
        vatRate: null,
        message: t("settings.integrations.testFailed"),
      })
      onChange({
        ...settings,
        integrations: { ...integrations, billingConnected: false },
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <SettingsSheet>
      <SettingsSection
        title={t("settings.integrations.billingTitle")}
        description={t("settings.integrations.billingDesc")}
      >
        <div className="grid gap-5">
          <SettingsField label={t("settings.integrations.providerLabel")} className="max-w-md">
            <select
              id="billing-provider"
              value={integrations.billingProvider}
              onChange={(e) =>
                onChange({
                  ...settings,
                  integrations: { ...integrations, billingProvider: e.target.value as InvoiceProvider },
                })
              }
              className={selectClass}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </SettingsField>
          <p className={cn(hintClass, "max-w-2xl")}>{t("settings.integrations.keyNotice")}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" variant="outline" disabled={testing} onClick={runTest} className="gap-2">
              {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {t("settings.integrations.testConnection")}
            </Button>
            <StateLine state={integrations.billingConnected ? "done" : "unsure"}>
              {integrations.billingConnected ? t("settings.integrations.connected") : t("settings.integrations.notVerified")}
            </StateLine>
          </div>
          {ping && (
            <dl className="max-w-xl divide-y divide-hair-soft border-y border-hair-soft text-sm">
              <Detail
                label={t("settings.integrations.pingProvider")}
                value={ping.live ? ping.provider : t("settings.integrations.simulated")}
              />
              {ping.draftsOnly && (
                <Detail
                  label={t("settings.integrations.pingMode")}
                  value={t("settings.integrations.draftsOnly")}
                  tone="warning"
                />
              )}
              {ping.vatRate != null && (
                <Detail
                  label={t("settings.integrations.pingVat")}
                  value={`${formatVatRate(ping.vatRate)}%`}
                />
              )}
              {ping.message && !ping.ok && (
                <Detail
                  label={t("settings.integrations.pingProblem")}
                  value={ping.message}
                  tone="error"
                />
              )}
            </dl>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("settings.integrations.calendarTitle")}
        description={t("settings.integrations.calendarDesc")}
      >
        {/* The Google switch that used to sit here connected nothing — it
            flipped a stored boolean no code read. A subscription link that
            works replaces it. */}
        <CalendarSubscription />

        <SwitchRow
          className="mt-5"
          checked={integrations.outlookConnected}
          ariaLabel={t("settings.integrations.outlookAria")}
          onCheckedChange={(outlookConnected) =>
            onChange({ ...settings, integrations: { ...integrations, outlookConnected } })
          }
          title={t("settings.integrations.outlookTitle")}
          sub={t("settings.integrations.outlookSub")}
        />
      </SettingsSection>
    </SettingsSheet>
  )
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "warning" | "error"
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <dt className="text-mute">{label}</dt>
      <dd className="flex items-center gap-2 text-end font-medium text-ink">
        {/* Drafts-only and a failed check are both "not yet real": the dashed ring. */}
        {tone ? <StateMark state="unsure" /> : null}
        {value}
      </dd>
    </div>
  )
}
