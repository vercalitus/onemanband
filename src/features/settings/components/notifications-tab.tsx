"use client"

import { Bell, Mail } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { cn } from "@/lib/utils"
import type { ClinicSettings } from "@/types/clinic-settings"

export function NotificationsTab({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const { notifications: n } = settings

  const patch = (partial: Partial<typeof n>) =>
    onChange({ ...settings, notifications: { ...n, ...partial } })

  return (
    <div className="space-y-5">
      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Bell className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">
                {t("settings.notifications.remindersTitle")}
              </CardTitle>
              <CardDescription className="text-sky-100/80">{t("settings.notifications.remindersDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "space-y-5")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Switch
                checked={n.whatsappEnabled}
                aria-label={t("settings.notifications.whatsappAria")}
                onCheckedChange={(v) => patch({ whatsappEnabled: v })}
              />
              <span className="text-sm font-semibold text-slate-900">{t("settings.notifications.whatsappLabel")}</span>
            </div>
            <div className="flex items-center gap-3 sm:ps-6">
              <Switch checked={n.smsEnabled} aria-label={t("settings.notifications.smsAria")} onCheckedChange={(v) => patch({ smsEnabled: v })} />
              <span className="text-sm font-semibold text-slate-900">{t("settings.notifications.smsLabel")}</span>
            </div>
          </div>
          <div className="grid max-w-xs gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="hours-before">
              {t("settings.notifications.hoursBeforeLabel")}
            </label>
            <Input
              id="hours-before"
              type="number"
              min={1}
              max={168}
              value={n.hoursBefore}
              onChange={(e) => patch({ hoursBefore: Math.max(1, Number(e.target.value) || 1) })}
              className="h-9 rounded-lg border-slate-200 font-mono tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="template">
              {t("settings.notifications.templateLabel")}
            </label>
            <textarea
              id="template"
              value={n.messageTemplate}
              onChange={(e) => patch({ messageTemplate: e.target.value })}
              rows={5}
              className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
        </CardContent>
      </Card>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Mail className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">{t("settings.notifications.insightsTitle")}</CardTitle>
              <CardDescription className="text-sky-100/80">{t("settings.notifications.insightsDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={n.dailyDigest}
                aria-label={t("settings.notifications.digestAria")}
                onCheckedChange={(dailyDigest) => patch({ dailyDigest })}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("settings.notifications.digestTitle")}</p>
                <p className="text-xs text-slate-500">{t("settings.notifications.digestSub")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:border-s sm:border-slate-200 sm:ps-8">
              <Switch
                checked={n.weeklyReport}
                aria-label={t("settings.notifications.weeklyAria")}
                onCheckedChange={(weeklyReport) => patch({ weeklyReport })}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("settings.notifications.weeklyTitle")}</p>
                <p className="text-xs text-slate-500">{t("settings.notifications.weeklySub")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
