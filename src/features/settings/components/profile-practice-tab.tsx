"use client"

import { Building2, Clock, User } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { cn } from "@/lib/utils"
import type { ClinicSettings } from "@/types/clinic-settings"

export function ProfilePracticeTab({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { profile, weekdays } = settings

  return (
    <div className="space-y-5">
      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <User className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">Professional profile</CardTitle>
              <CardDescription className="text-sky-100/80">
                How you appear to patients on invoices and reminders.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "grid gap-4 sm:grid-cols-2")}>
          <Field label="Full name">
            <Input
              value={profile.practitionerName}
              onChange={(e) =>
                onChange({ ...settings, profile: { ...profile, practitionerName: e.target.value } })
              }
              placeholder="Dr. Jordan Lee"
              className="rounded-xl border-slate-200"
            />
          </Field>
          <Field label="Professional phone">
            <Input
              value={profile.phone}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, phone: e.target.value } })}
              placeholder="+972-50-000-0000"
              className="rounded-xl border-slate-200"
            />
          </Field>
          <Field label="Professional email" className="sm:col-span-2">
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, email: e.target.value } })}
              placeholder="care@clinic.example"
              className="rounded-xl border-slate-200"
            />
          </Field>
        </CardContent>
      </Card>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Building2 className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">Practice & branding</CardTitle>
              <CardDescription className="text-sky-100/80">
                Clinic name appears in the sidebar; address is used on invoices.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "grid gap-4 sm:grid-cols-2")}>
          <Field label="Clinic name">
            <Input
              value={profile.clinicName}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, clinicName: e.target.value } })}
              placeholder="Serene Spine Clinic"
              className="rounded-xl border-slate-200"
            />
          </Field>
          <Field label="Clinic logo">
            <div className="flex flex-wrap items-center gap-3">
              {profile.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL from user upload
                <img
                  src={profile.logoDataUrl}
                  alt=""
                  className="size-14 rounded-lg border border-slate-200 bg-white object-contain p-1"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-400">
                  No logo
                </div>
              )}
              <label className="cursor-pointer">
                <span className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                  Upload image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 400_000) {
                      alert("Please use an image under 400 KB for this demo.")
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = () => {
                      const url = typeof reader.result === "string" ? reader.result : null
                      onChange({ ...settings, profile: { ...profile, logoDataUrl: url } })
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
              {profile.logoDataUrl ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, profile: { ...profile, logoDataUrl: null } })}
                  className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Stored locally in the browser for this demo.</p>
          </Field>
          <Field label="Physical address (invoices)" className="sm:col-span-2">
            <Input
              value={profile.address}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, address: e.target.value } })}
              placeholder="123 Wellness St, Tel Aviv"
              className="rounded-xl border-slate-200"
            />
          </Field>
        </CardContent>
      </Card>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Clock className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">Clinic schedule</CardTitle>
              <CardDescription className="text-sky-100/80">
                Default hours shown to staff; calendar booking rules can use this later.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <ul className="space-y-3">
            {weekdays.map((day, i) => (
              <li
                key={day.label}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={day.open}
                    aria-label={`${day.label} open`}
                    onCheckedChange={(open) => {
                      const next = [...weekdays]
                      next[i] = { ...next[i], open }
                      onChange({ ...settings, weekdays: next })
                    }}
                  />
                  <span className="min-w-[100px] text-sm font-semibold text-slate-800">{day.label}</span>
                </div>
                {day.open ? (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="text-xs font-medium text-slate-500">From</span>
                    <Input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => {
                        const next = [...weekdays]
                        next[i] = { ...next[i], openTime: e.target.value }
                        onChange({ ...settings, weekdays: next })
                      }}
                      className="w-32 rounded-lg border-slate-200 bg-white font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs font-medium text-slate-500">To</span>
                    <Input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => {
                        const next = [...weekdays]
                        next[i] = { ...next[i], closeTime: e.target.value }
                        onChange({ ...settings, weekdays: next })
                      }}
                      className="w-32 rounded-lg border-slate-200 bg-white font-mono text-sm tabular-nums"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Closed</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {children}
    </div>
  )
}
