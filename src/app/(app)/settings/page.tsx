"use client"

import { useState } from "react"
import { Loader2, Settings2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AutomationsTab } from "@/features/settings/components/automations-tab"
import { ClinicalPreferencesTab } from "@/features/settings/components/clinical-preferences-tab"
import { IntegrationsTab } from "@/features/settings/components/integrations-tab"
import { NotificationsTab } from "@/features/settings/components/notifications-tab"
import { ProfilePracticeTab } from "@/features/settings/components/profile-practice-tab"
import { SecurityTab } from "@/features/settings/components/security-tab"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const { t, isRtl } = useLocale()
  const { settings, setSettings, isDirty, save, discard, hydrated } = useClinicSettings()
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    window.setTimeout(() => {
      save()
      setSaving(false)
    }, 400)
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="size-5 animate-spin text-sky-600" aria-hidden />
        <span className="ms-2">{t("settings.loading")}</span>
      </div>
    )
  }

  const tabCfg = [
    { id: "profile", labelKey: "settings.tab.profile" as const },
    { id: "integrations", labelKey: "settings.tab.integrations" as const },
    { id: "clinical", labelKey: "settings.tab.clinical" as const },
    { id: "notifications", labelKey: "settings.tab.notifications" as const },
    { id: "automations", labelKey: "settings.tab.automations" as const },
    { id: "security", labelKey: "settings.tab.security" as const },
  ]

  return (
    <div className={cn("space-y-6", isDirty && "pb-24")}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <Settings2 className="size-6 text-sky-600" aria-hidden />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("settings.title")}</h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{t("settings.subtitle")}</p>
      </header>

      <Tabs defaultValue="profile" className="flex flex-col gap-6">
        <TabsList variant="line" className="w-full min-w-0 justify-start gap-0 border-b border-slate-200 bg-transparent p-0">
          {tabCfg.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-500 data-active:border-sky-600 data-active:text-slate-900 data-active:shadow-none"
            >
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="profile"
          className="mt-0 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <ProfilePracticeTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent
          value="integrations"
          className="mt-0 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <IntegrationsTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent
          value="clinical"
          className="mt-0 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <ClinicalPreferencesTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent
          value="notifications"
          className="mt-0 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <NotificationsTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent
          value="automations"
          className="mt-0 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <AutomationsTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent
          value="security"
          className="mt-0 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <SecurityTab />
        </TabsContent>
      </Tabs>

      {isDirty ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-50",
            isRtl ? "lg:pe-72" : "lg:ps-72",
          )}
          role="region"
          aria-label={t("settings.saveBar.region")}
        >
          <div className="pointer-events-auto border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:px-6">
            <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-600">{t("settings.saveBar.hint")}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={discard} className="text-slate-600">
                  {t("settings.discard")}
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving} className="min-w-[140px] gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
