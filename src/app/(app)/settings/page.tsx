"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { PagePlate, PlateLabel, PlateSpacer } from "@/components/layout/page-plate"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClinicalPreferencesTab } from "@/features/settings/components/clinical-preferences-tab"
import { DataExportTab } from "@/features/settings/components/data-export-tab"
import { IntegrationsTab } from "@/features/settings/components/integrations-tab"
import { NotificationsTab } from "@/features/settings/components/notifications-tab"
import { ProfilePracticeTab } from "@/features/settings/components/profile-practice-tab"
import { SecurityTab } from "@/features/settings/components/security-tab"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const { t } = useLocale()
  const { settings, setSettings, isDirty, save, discard, hydrated } = useClinicSettings()
  const [saving, setSaving] = useState(false)

  /**
   * Whether the plate is still on screen. The plate scrolls away with the page
   * (see the app layout), and a change is usually made far down a tab — so once
   * it has gone, the same save comes back as a bar at the foot. Only one of the
   * two is ever shown: one orange button per screen.
   */
  const topRef = useRef<HTMLDivElement>(null)
  const [plateInView, setPlateInView] = useState(true)
  useEffect(() => {
    const el = topRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setPlateInView(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [hydrated])

  const handleSave = () => {
    setSaving(true)
    window.setTimeout(() => {
      save()
      setSaving(false)
    }, 400)
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-mute">
        <Loader2 className="size-5 animate-spin text-cobalt" aria-hidden />
        <span className="ms-2">{t("settings.loading")}</span>
      </div>
    )
  }

  const tabCfg = [
    { id: "profile", labelKey: "settings.tab.profile" as const },
    { id: "integrations", labelKey: "settings.tab.integrations" as const },
    { id: "clinical", labelKey: "settings.tab.clinical" as const },
    // Channels, sequences, content and the queue are one subject and live in
    // one tab — a separate "Automations" tab sent people looking for message
    // settings to the wrong place.
    { id: "notifications", labelKey: "settings.tab.notifications" as const },
    { id: "data", labelKey: "settings.tab.data" as const },
    { id: "security", labelKey: "settings.tab.security" as const },
  ]

  const saveButton = (
    <Button type="button" onClick={handleSave} disabled={saving} className="min-w-[140px] gap-2">
      {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {t("settings.save")}
    </Button>
  )

  return (
    <div className={cn("relative mx-auto max-w-[1040px] space-y-6", isDirty && "pb-24")}>
      <PagePlate>
        <div className="flex min-w-0 flex-col">
          {settings.profile.clinicName ? <PlateLabel>{settings.profile.clinicName}</PlateLabel> : null}
          <h1 className="mt-0.5 truncate font-display text-[40px] leading-[0.95] text-white sm:text-[56px]">
            {t("settings.title")}
          </h1>
        </div>
        <PlateSpacer />
        {isDirty ? (
          <div className="flex flex-wrap items-center gap-3" role="region" aria-label={t("settings.saveBar.region")}>
            <PlateLabel now>{t("settings.saveBar.hint")}</PlateLabel>
            <Button
              type="button"
              variant="outline"
              onClick={discard}
              className="border-white/25 bg-transparent text-white hover:bg-white/10"
            >
              {t("settings.discard")}
            </Button>
            {plateInView ? saveButton : null}
          </div>
        ) : null}
      </PagePlate>

      <div ref={topRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
      <p className="max-w-2xl text-sm leading-snug text-mute">{t("settings.subtitle")}</p>

      <Tabs defaultValue="profile" className="flex flex-col gap-6">
        <TabsList variant="line" className="w-full min-w-0 justify-start gap-0 border-b border-hair p-0">
          {tabCfg.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="px-3 lg:px-4">
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-0 outline-none">
          <ProfilePracticeTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-0 outline-none">
          <IntegrationsTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent value="clinical" className="mt-0 outline-none">
          <ClinicalPreferencesTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-0 outline-none">
          <NotificationsTab settings={settings} onChange={setSettings} />
        </TabsContent>
        <TabsContent value="data" className="mt-0 outline-none">
          <DataExportTab />
        </TabsContent>
        <TabsContent value="security" className="mt-0 outline-none">
          <SecurityTab />
        </TabsContent>
      </Tabs>

      {isDirty && !plateInView ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:ps-[88px]"
          role="region"
          aria-label={t("settings.saveBar.region")}
        >
          <div className="pointer-events-auto border-t border-hair bg-paper px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="size-2.5 shrink-0 rounded-full bg-signal" aria-hidden />
                {t("settings.saveBar.hint")}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={discard}>
                  {t("settings.discard")}
                </Button>
                {saveButton}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
