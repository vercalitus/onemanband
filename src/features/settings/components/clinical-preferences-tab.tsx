"use client"

import { ClipboardList, Layers, Plus, Stethoscope, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
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
          name: "New package",
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
    <div className="space-y-5">
      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Stethoscope className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">Appointment types & pricing</CardTitle>
              <CardDescription className="text-sky-100/80">
                Drives calendar colours and default amounts when generating invoices from visits.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-4 py-3">Type key</th>
                  <th className="px-4 py-3">Display name</th>
                  <th className="px-4 py-3">Default length</th>
                  <th className="px-4 py-3">Colour</th>
                  <th className="px-4 py-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {treatmentTypes.map((row, i) => (
                  <tr key={row.type} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.type}</td>
                    <td className="px-4 py-3">
                      <Input
                        value={row.label}
                        onChange={(e) => updateType(i, { label: e.target.value })}
                        className="h-9 rounded-lg border-slate-200"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={5}
                          max={120}
                          step={5}
                          value={row.defaultMinutes}
                          onChange={(e) => updateType(i, { defaultMinutes: Number(e.target.value) || 5 })}
                          className="h-9 w-20 rounded-lg border-slate-200 font-mono tabular-nums"
                        />
                        <span className="text-xs text-slate-500">min</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.colorPreset}
                        onChange={(e) =>
                          updateType(i, { colorPreset: e.target.value as TreatmentColorPreset })
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      >
                        {PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Input
                          aria-label={`Price for ${row.type}`}
                          value={String(row.priceIls)}
                          onChange={(e) =>
                            updateType(i, { priceIls: Math.max(0, parseIlsInput(e.target.value)) })
                          }
                          className="inline-block h-9 w-28 rounded-lg border-slate-200 text-right font-mono tabular-nums"
                        />
                        <span className="text-sm font-medium text-slate-600">₪</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Layers className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">Care plans</CardTitle>
              <CardDescription className="text-sky-100/80">
                Package pricing for multi-visit bundles (Finances can reference these later).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "space-y-4")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                htmlFor="default-sessions"
              >
                Default treatment plan length
              </label>
              <div className="flex items-center gap-2">
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
                  className="h-9 w-24 rounded-lg border-slate-200 font-mono tabular-nums"
                />
                <span className="text-sm text-slate-600">sessions</span>
              </div>
            </div>
            <Button type="button" variant="secondary" className="gap-1.5 self-start" onClick={addPlan}>
              <Plus className="size-4" aria-hidden />
              Add package
            </Button>
          </div>

          <ul className="space-y-3">
            {carePlans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 lg:flex-row lg:items-center"
              >
                <Input
                  value={plan.name}
                  onChange={(e) => {
                    onChange({
                      ...settings,
                      carePlans: carePlans.map((p) => (p.id === plan.id ? { ...p, name: e.target.value } : p)),
                    })
                  }}
                  className="h-9 flex-1 rounded-lg border-slate-200 lg:max-w-xs"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
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
                      className="h-9 w-20 rounded-lg border-slate-200 font-mono tabular-nums"
                    />
                    <span className="text-xs text-slate-500">visits</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label="Total price"
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
                      className="h-9 w-28 rounded-lg border-slate-200 text-right font-mono tabular-nums"
                    />
                    <span className="text-xs font-medium text-slate-500">₪ total</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlan(plan.id)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove package"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <ClipboardList className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">Clinical reference</CardTitle>
              <CardDescription className="text-sky-100/80">
                Template tags for reminders: {"{patient_name}"}, {"{time}"}, {"{date}"}, {"{clinic_name}"}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <p className="text-sm leading-relaxed text-slate-600">
            Adjust prices above whenever your fee schedule changes — outstanding mock invoices keep their historic
            amounts until edited in Billing.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
