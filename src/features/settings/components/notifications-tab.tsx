"use client"

import { Bell, Mail } from "lucide-react"

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
              <CardTitle className="text-lg font-bold tracking-tight text-white">Patient reminders</CardTitle>
              <CardDescription className="text-sky-100/80">
                Channel toggles are prefab — hook WhatsApp / SMS providers when you go live.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "space-y-5")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Switch checked={n.whatsappEnabled} aria-label="WhatsApp" onCheckedChange={(v) => patch({ whatsappEnabled: v })} />
              <span className="text-sm font-semibold text-slate-900">WhatsApp reminders</span>
            </div>
            <div className="flex items-center gap-3 sm:pl-6">
              <Switch checked={n.smsEnabled} aria-label="SMS" onCheckedChange={(v) => patch({ smsEnabled: v })} />
              <span className="text-sm font-semibold text-slate-900">SMS reminders</span>
            </div>
          </div>
          <div className="grid max-w-xs gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="hours-before">
              Send how many hours before?
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
              Message template
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
              <CardTitle className="text-lg font-bold tracking-tight text-white">Admin insights</CardTitle>
              <CardDescription className="text-sky-100/80">
                Automated performance digests for the practitioner — email delivery can be wired later.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={n.dailyDigest}
                aria-label="Daily digest"
                onCheckedChange={(dailyDigest) => patch({ dailyDigest })}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Daily digest</p>
                <p className="text-xs text-slate-500">Morning summary: sessions, revenue pulse, alerts</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-8">
              <Switch
                checked={n.weeklyReport}
                aria-label="Weekly report"
                onCheckedChange={(weeklyReport) => patch({ weeklyReport })}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Weekly report</p>
                <p className="text-xs text-slate-500">Friday rollup: collection, no-shows, trends</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
