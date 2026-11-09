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
    <div className="divide-y divide-hair">
      <section className="pb-6">
        <p className="text-sm text-mute">{t("insights.paidThisMonth")}</p>
        <p className="mt-1 font-display text-[40px] leading-none tabular-nums text-ink">
          {formatMoney(monthly)}
        </p>
        <p className="mt-2 text-sm text-mute">{t("insights.acrossTypes", { count: typeCount })}</p>
      </section>

      <section className="py-6">
        <h3 className="text-[17px] font-bold text-ink">{t("insights.revenueByType")}</h3>
        <p className="mt-0.5 text-sm text-mute">{t("insights.revenueByTypeSub")}</p>

        {/* One colour for every type: the type is named in text, never coded
            in colour (DESIGN.md), and the bar's length is the whole message. */}
        <ul className="mt-4 space-y-4">
          {rows.map((row) => {
            const widthPct = Math.max(2, Math.round((row.revenue / maxRevenue) * 100))
            return (
              <li key={row.type}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[17px] text-ink">{row.label}</p>
                  <p className="text-[17px] font-bold tabular-nums text-ink">
                    {formatMoney(row.revenue)}
                    <span className="ms-2 text-sm font-normal text-mute">{row.share}%</span>
                  </p>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[2px] bg-sunk">
                  <div
                    className={cn(
                      "h-full rounded-[2px] bg-cobalt transition-[width] duration-300 ease-out",
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

      <section className="py-6">
        <p className="text-sm text-mute">{t("insights.projectedRevenue")}</p>
        <p className="mt-1 font-display text-[40px] leading-none tabular-nums text-ink">
          {formatMoney(projectedTotal)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          {t("insights.projectedBlurb", { count: projectedCount, range: rangeLabel })}
        </p>
      </section>

      <section className="pt-6 text-sm text-mute">
        <p className="font-medium text-ink">{t("insights.roadmap.title")}</p>
        <p className="mt-1 leading-relaxed">{t("insights.roadmap.body")}</p>
      </section>
    </div>
  )
}
