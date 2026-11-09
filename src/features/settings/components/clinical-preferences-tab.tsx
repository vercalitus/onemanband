"use client"

import { Plus, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SettingsSection,
  SettingsSheet,
  hintClass,
  inputClass,
  labelClass,
  numericInputClass,
  selectClass,
} from "@/features/settings/components/settings-ui"
import { parseIlsInput } from "@/lib/format-ils"
import { cn } from "@/lib/utils"
import type { ClinicSettings, TreatmentColorPreset } from "@/types/clinic-settings"

const PRESETS: TreatmentColorPreset[] = ["violet", "emerald", "amber", "sky", "rose"]

export function ClinicalPreferencesTab({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const { treatmentTypes, carePlans, defaultPlanSessions } = settings

  const updateType = (index: number, patch: Partial<(typeof treatmentTypes)[number]>) => {
    const next = [...treatmentTypes]
    next[index] = { ...next[index], ...patch }
    onChange({ ...settings, treatmentTypes: next })
  }

  const addPlan = () => {
    onChange({
      ...settings,
      carePlans: [
        ...carePlans,
        {
          id: `cp-${Date.now()}`,
          name: t("settings.clinical.newPackageName"),
          sessions: 6,
          totalPriceIls: 1200,
        },
      ],
    })
  }

  const removePlan = (id: string) => {
    onChange({ ...settings, carePlans: carePlans.filter((p) => p.id !== id) })
  }

  return (
    <SettingsSheet>
      <SettingsSection
        title={t("settings.clinical.typesTitle")}
        description={t("settings.clinical.typesDesc")}
        bodyClassName="-mx-4 overflow-x-auto sm:-mx-6"
      >
        <table className="w-full min-w-[640px] text-start">
          <thead>
            <tr className="border-y border-hair-soft text-sm font-medium text-mute">
              <th className="px-4 py-2.5 text-start font-medium sm:ps-6">{t("settings.clinical.thTypeKey")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t("settings.clinical.thDisplayName")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t("settings.clinical.thDefaultLength")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t("settings.clinical.thColour")}</th>
              <th className="px-4 py-2.5 text-end font-medium sm:pe-6">{t("settings.clinical.thPrice")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair-soft">
            {treatmentTypes.map((row, i) => (
              <tr key={row.type}>
                <td className="px-4 py-3 font-mono text-sm text-mute sm:ps-6">{row.type}</td>
                <td className="px-3 py-3">
                  <Input
                    value={row.label}
                    onChange={(e) => updateType(i, { label: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      step={5}
                      value={row.defaultMinutes}
                      onChange={(e) => updateType(i, { defaultMinutes: Number(e.target.value) || 5 })}
                      className={cn(numericInputClass, "w-20")}
                    />
                    <span className="text-sm text-mute">{t("settings.clinical.minSuffix")}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={row.colorPreset}
                    onChange={(e) =>
                      updateType(i, { colorPreset: e.target.value as TreatmentColorPreset })
                    }
                    className={cn(selectClass, "w-auto min-w-28")}
                  >
                    {PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {t(`settings.color.${p}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-end sm:pe-6">
                  <div className="inline-flex items-center justify-end gap-2">
                    <Input
                      aria-label={t("settings.clinical.priceAria", { type: row.type })}
                      value={String(row.priceIls)}
                      onChange={(e) =>
                        updateType(i, { priceIls: Math.max(0, parseIlsInput(e.target.value)) })
                      }
                      className={cn(numericInputClass, "inline-block w-28 text-end")}
                    />
                    <span className="text-sm font-medium text-mute">₪</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsSection>

      <SettingsSection
        title={t("settings.clinical.plansTitle")}
        description={t("settings.clinical.plansDesc")}
        action={
          <Button type="button" variant="outline" className="gap-2" onClick={addPlan}>
            <Plus className="size-4" aria-hidden />
            {t("settings.clinical.addPackage")}
          </Button>
        }
      >
        <div className="grid gap-5">
          <label className="grid gap-1.5" htmlFor="default-sessions">
            <span className={labelClass}>{t("settings.clinical.defaultPlanLength")}</span>
            <span className="flex items-center gap-2">
              <Input
                id="default-sessions"
                type="number"
                min={1}
                max={99}
                value={defaultPlanSessions}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    defaultPlanSessions: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className={cn(numericInputClass, "w-24")}
              />
              <span className="text-sm text-mute">{t("settings.clinical.sessionsWord")}</span>
            </span>
          </label>

          {carePlans.length ? (
            <ul className="-mx-4 divide-y divide-hair-soft border-y border-hair-soft sm:-mx-6">
              {carePlans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center"
                >
                  <Input
                    value={plan.name}
                    onChange={(e) => {
                      onChange({
                        ...settings,
                        carePlans: carePlans.map((p) => (p.id === plan.id ? { ...p, name: e.target.value } : p)),
                      })
                    }}
                    className={cn(inputClass, "flex-1 lg:max-w-xs")}
                  />
                  <div className="flex flex-wrap items-center gap-3 lg:ms-auto">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={plan.sessions}
                        onChange={(e) => {
                          const sessions = Math.max(1, Number(e.target.value) || 1)
                          onChange({
                            ...settings,
                            carePlans: carePlans.map((p) => (p.id === plan.id ? { ...p, sessions } : p)),
                          })
                        }}
                        className={cn(numericInputClass, "w-20")}
                      />
                      <span className="text-sm text-mute">{t("settings.clinical.visitsWord")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={t("settings.clinical.totalPriceAria")}
                        value={String(plan.totalPriceIls)}
                        onChange={(e) => {
                          const totalPriceIls = Math.max(0, parseIlsInput(e.target.value))
                          onChange({
                            ...settings,
                            carePlans: carePlans.map((p) =>
                              p.id === plan.id ? { ...p, totalPriceIls } : p,
                            ),
                          })
                        }}
                        className={cn(numericInputClass, "w-28 text-end")}
                      />
                      <span className="text-sm font-medium text-mute">{t("settings.clinical.ilsTotal")}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlan(plan.id)}
                      className="text-mute hover:text-ink"
                      aria-label={t("settings.clinical.removePackageAria")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings.clinical.refTitle")} description={t("settings.clinical.refDesc")}>
        <p className={cn(hintClass, "max-w-2xl")}>{t("settings.clinical.refHint")}</p>
      </SettingsSection>
    </SettingsSheet>
  )
}
