"use client"

import { Calendar, Link2, Loader2, Wallet } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { cn } from "@/lib/utils"
import type { InvoiceProvider } from "@/types/domain"
import type { ClinicSettings } from "@/types/clinic-settings"

const PROVIDERS: InvoiceProvider[] = ["Green Invoice", "Morning", "Invoice4U"]

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

  const runTest = () => {
    setTesting(true)
    window.setTimeout(() => {
      setTesting(false)
      onChange({
        ...settings,
        integrations: { ...integrations, billingConnected: true },
      })
    }, 900)
  }

  return (
    <div className="space-y-5">
      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Wallet className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">
                {t("settings.integrations.billingTitle")}
              </CardTitle>
              <CardDescription className="text-sky-100/80">
                {t("settings.integrations.billingDesc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "grid gap-4")}>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="billing-provider">
              {t("settings.integrations.providerLabel")}
            </label>
            <select
              id="billing-provider"
              value={integrations.billingProvider}
              onChange={(e) =>
                onChange({
                  ...settings,
                  integrations: { ...integrations, billingProvider: e.target.value as InvoiceProvider },
                })
              }
              className="h-10 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="api-key">
              {t("settings.integrations.apiKeyLabel")}
            </label>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              value={integrations.billingApiKey}
              onChange={(e) =>
                onChange({
                  ...settings,
                  integrations: { ...integrations, billingApiKey: e.target.value },
                })
              }
              placeholder={t("settings.integrations.apiKeyPlaceholder")}
              className="max-w-xl rounded-xl border-slate-200 font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" disabled={testing} onClick={runTest} className="gap-2">
              {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {t("settings.integrations.testConnection")}
            </Button>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                integrations.billingConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  integrations.billingConnected ? "bg-emerald-500" : "bg-slate-400",
                )}
                aria-hidden
              />
              {integrations.billingConnected ? t("settings.integrations.connected") : t("settings.integrations.notVerified")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Calendar className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">{t("settings.integrations.calendarTitle")}</CardTitle>
              <CardDescription className="text-sky-100/80">{t("settings.integrations.calendarDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={integrations.googleCalendarConnected}
                aria-label={t("settings.integrations.googleAria")}
                onCheckedChange={(googleCalendarConnected) =>
                  onChange({ ...settings, integrations: { ...integrations, googleCalendarConnected } })
                }
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("settings.integrations.googleTitle")}</p>
                <p className="text-xs text-slate-500">{t("settings.integrations.googleSub")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:border-s border-slate-200 sm:ps-8">
              <Switch
                checked={integrations.outlookConnected}
                aria-label={t("settings.integrations.outlookAria")}
                onCheckedChange={(outlookConnected) =>
                  onChange({ ...settings, integrations: { ...integrations, outlookConnected } })
                }
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("settings.integrations.outlookTitle")}</p>
                <p className="text-xs text-slate-500">{t("settings.integrations.outlookSub")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
