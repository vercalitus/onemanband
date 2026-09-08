"use client"

import { useMemo } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"
import {
  computeMonthlyRevenue,
  computeRevenueByTreatment,
  sumProjectedRevenue,
} from "@/features/finances/lib/derive-billing"
import { localeToBcp47 } from "@/lib/format-locale"
import { cn } from "@/lib/utils"
import type {
  BillingInvoice,
  BillingTreatmentType,
  ProjectedCalendarVisit,
} from "@/types/domain"

const TYPE_TONE: Record<BillingTreatmentType, string> = {
  first: "bg-violet-500",
  adjustments: "bg-emerald-500",
  kupa: "bg-amber-500",
}

/** Insights drawer — currency + copy follow locale; progress bars align in RTL. */
export function InsightsPanel({ invoices }: { invoices: BillingInvoice[] }) {
  const { locale, isRtl, formatMoney, t } = useLocale()
  const { appointments } = useScheduleDay()
  const { settings } = useClinicSettings()

  const treatmentLabels = useMemo(
    () =>
      ({
        first: t("billing.treatment.first"),
        adjustments: t("billing.treatment.adjustments"),
        kupa: t("billing.treatment.kupa"),
      }) satisfies Record<BillingTreatmentType, string>,
    [t],
  )

  const rows = computeRevenueByTreatment(invoices, treatmentLabels)
  const monthly = computeMonthlyRevenue(invoices)
  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1)

  /**
   * What the week ahead is worth, from the diary and the clinic's own prices.
   *
   * This was a fixed list of invented visits, so the figure was the same every
   * week and belonged to nobody — a forecast of a fictional clinic shown beside
   * real takings. A clinic with an empty week ahead now sees zero, which is
   * both true and useful.
   */
  const projected = useMemo(() => {
    const priceOf = new Map(settings.treatmentTypes.map((tt) => [tt.type, tt.priceIls]))
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return appointments.filter((a) => {
      if (a.status === "cancelled" || a.status === "no_show") return false
      const day = new Date(`${a.date}T00:00:00`)
      return day >= start && day < end
    })
    .map<ProjectedCalendarVisit>((a) => ({
      id: a.id,
      date: a.date,
      patientId: a.patientId,
      patientName: a.patientName,
      treatmentType: a.appointmentType,
      estimatedAmount: priceOf.get(a.appointmentType) ?? 0,
    }))
  }, [appointments, settings])

  const projectedTotal = sumProjectedRevenue(projected)
  const projectedCount = projected.length

  const rangeLabel = useMemo(() => {
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 6)
    const fmt = new Intl.DateTimeFormat(localeToBcp47(locale), {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    return `${fmt.format(start)} – ${fmt.format(end)}`
  }, [locale])

  const typeCount = rows.filter((r) => r.revenue > 0).length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t("insights.paidThisMonth")}
        </p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900">
          {formatMoney(monthly)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t("insights.acrossTypes", { count: typeCount })}</p>
      </section>

      <section>
        <h3 className="font-heading text-sm font-semibold tracking-tight text-slate-900">
          {t("insights.revenueByType")}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">{t("insights.revenueByTypeSub")}</p>

        <ul className="mt-4 space-y-3.5">
          {rows.map((row) => {
            const widthPct = Math.max(2, Math.round((row.revenue / maxRevenue) * 100))
            return (
              <li key={row.type}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{row.label}</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {formatMoney(row.revenue)}
                    <span className="ms-2 text-[11px] font-normal text-slate-400">{row.share}%</span>
                  </p>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300 ease-out",
                      TYPE_TONE[row.type],
                      isRtl && "ms-auto",
                    )}
                    style={{ width: `${widthPct}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t("insights.projectedRevenue")}
        </p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900">
          {formatMoney(projectedTotal)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {t("insights.projectedBlurb", { count: projectedCount, range: rangeLabel })}
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">{t("insights.roadmap.title")}</p>
        <p className="mt-1 leading-relaxed">{t("insights.roadmap.body")}</p>
      </section>
    </div>
  )
}
