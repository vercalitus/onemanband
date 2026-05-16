"use client"

import { formatCurrency, projectedCalendarWeek } from "@/lib/mock-finances"
import {
  computeMonthlyRevenue,
  computeRevenueByTreatment,
  sumProjectedRevenue,
} from "@/features/finances/lib/derive-billing"
import { cn } from "@/lib/utils"
import type { BillingInvoice, BillingTreatmentType } from "@/types/domain"

const TYPE_TONE: Record<BillingTreatmentType, string> = {
  first: "bg-violet-500",
  adjustments: "bg-emerald-500",
  kupa: "bg-amber-500",
}

function formatWeekRangeLabel(): string {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 6)
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

/**
 * Insights drawer content — revenue split by treatment type for the current
 * month. Bars are pure flex/width divs so we don't pull in a chart library
 * for a single visualisation.
 */
export function InsightsPanel({ invoices }: { invoices: BillingInvoice[] }) {
  const rows = computeRevenueByTreatment(invoices)
  const monthly = computeMonthlyRevenue(invoices)
  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1)
  const projectedTotal = sumProjectedRevenue(projectedCalendarWeek)
  const projectedCount = projectedCalendarWeek.length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Paid this month
        </p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900">
          {formatCurrency(monthly)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Across {rows.filter((r) => r.revenue > 0).length} treatment types.
        </p>
      </section>

      <section>
        <h3 className="font-heading text-sm font-semibold tracking-tight text-slate-900">
          Revenue by treatment type
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Share of paid invoices in the current month.
        </p>

        <ul className="mt-4 space-y-3.5">
          {rows.map((row) => {
            const widthPct = Math.max(2, Math.round((row.revenue / maxRevenue) * 100))
            return (
              <li key={row.type}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{row.label}</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {formatCurrency(row.revenue)}
                    <span className="ml-2 text-[11px] font-normal text-slate-400">
                      {row.share}%
                    </span>
                  </p>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full transition-all", TYPE_TONE[row.type])}
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
          Projected revenue
        </p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900">
          {formatCurrency(projectedTotal)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Based on {projectedCount} scheduled visits in the next 7 days ({formatWeekRangeLabel()}). Uses
          the same calendar mock as the scheduler.
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Roadmap</p>
        <p className="mt-1 leading-relaxed">
          Cohort retention, payer mix, and yearly trend lines can plug in once live data is wired.
        </p>
      </section>
    </div>
  )
}
