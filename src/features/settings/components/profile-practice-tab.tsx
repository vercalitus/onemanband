"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  SettingsField,
  SettingsSection,
  SettingsSheet,
  hintClass,
  inputClass,
  numericInputClass,
} from "@/features/settings/components/settings-ui"
import { cn } from "@/lib/utils"
import type { ClinicSettings } from "@/types/clinic-settings"

export function ProfilePracticeTab({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const { profile, weekdays } = settings

  return (
    <SettingsSheet>
      <SettingsSection title={t("settings.profile.proCardTitle")} description={t("settings.profile.proCardDesc")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label={t("settings.profile.fullNameLabel")}>
            <Input
              value={profile.practitionerName}
              onChange={(e) =>
                onChange({ ...settings, profile: { ...profile, practitionerName: e.target.value } })
              }
              placeholder={t("settings.profile.fullNamePh")}
              className={inputClass}
            />
          </SettingsField>
          <SettingsField label={t("settings.profile.phoneLabel")}>
            <Input
              value={profile.phone}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, phone: e.target.value } })}
              placeholder={t("settings.profile.phonePh")}
              className={inputClass}
            />
          </SettingsField>
          <SettingsField label={t("settings.profile.emailLabel")} className="sm:col-span-2">
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, email: e.target.value } })}
              placeholder={t("settings.profile.emailPh")}
              className={inputClass}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings.profile.practiceTitle")} description={t("settings.profile.practiceDesc")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label={t("settings.profile.clinicNameLabel")}>
            <Input
              value={profile.clinicName}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, clinicName: e.target.value } })}
              placeholder={t("settings.profile.clinicNamePh")}
              className={inputClass}
            />
          </SettingsField>
          <SettingsField as="div" label={t("settings.profile.logoLabel")} hint={t("settings.logo.storeHint")}>
            <div className="flex flex-wrap items-center gap-3">
              {profile.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL from user upload
                <img
                  src={profile.logoDataUrl}
                  alt=""
                  className="size-14 rounded-md border border-hair bg-paper object-contain p-1"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-md border border-dashed border-hair px-1 text-center text-[13px] leading-tight text-mute">
                  {t("settings.logo.none")}
                </div>
              )}
              <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-hair bg-paper px-4 text-sm font-medium text-ink transition-colors hover:bg-ground focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-cobalt">
                {t("settings.logo.upload")}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 400_000) {
                      alert(t("settings.logo.sizeAlert"))
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
                  className="inline-flex h-11 items-center px-2 text-sm font-medium text-mute underline-offset-3 hover:text-ink hover:underline"
                >
                  {t("settings.logo.remove")}
                </button>
              ) : null}
            </div>
          </SettingsField>
          <SettingsField label={t("settings.profile.addressLabel")} className="sm:col-span-2">
            <Input
              value={profile.address}
              onChange={(e) => onChange({ ...settings, profile: { ...profile, address: e.target.value } })}
              placeholder={t("settings.profile.addressPh")}
              className={inputClass}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("settings.profile.scheduleTitle")}
        description={t("settings.profile.scheduleDesc")}
        bodyClassName="-mx-4 sm:-mx-6"
      >
        <ul className="divide-y divide-hair-soft border-t border-hair-soft">
          {weekdays.map((day, i) => (
            <li
              key={day.weekdayIndex}
              className="flex flex-col gap-2 px-4 py-2.5 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <Switch
                  checked={day.open}
                  aria-label={t(`settings.weekday.${day.weekdayIndex}`)}
                  onCheckedChange={(open) => {
                    const next = [...weekdays]
                    next[i] = { ...next[i], open }
                    onChange({ ...settings, weekdays: next })
                  }}
                />
                <span className={cn("min-w-[100px] text-[17px] font-medium", day.open ? "text-ink" : "text-mute")}>
                  {t(`settings.weekday.${day.weekdayIndex}`)}
                </span>
              </label>
              {day.open ? (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className={hintClass}>{t("settings.schedule.from")}</span>
                  <Input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => {
                      const next = [...weekdays]
                      next[i] = { ...next[i], openTime: e.target.value }
                      onChange({ ...settings, weekdays: next })
                    }}
                    className={cn(numericInputClass, "w-36")}
                  />
                  <span className={hintClass}>{t("settings.schedule.to")}</span>
                  <Input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => {
                      const next = [...weekdays]
                      next[i] = { ...next[i], closeTime: e.target.value }
                      onChange({ ...settings, weekdays: next })
                    }}
                    className={cn(numericInputClass, "w-36")}
                  />
                </div>
              ) : (
                <span className="text-sm text-mute">{t("settings.schedule.closed")}</span>
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsSheet>
  )
}
