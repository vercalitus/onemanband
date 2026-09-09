"use client"

import { useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { BILLING_STORE_EVENT } from "@/features/automations/lib/billing-bridge"
import { computePulseMetrics } from "@/features/dashboard/lib/pulse-metrics"
import { fetchInvoices } from "@/features/finances/lib/finance-repository"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { useClinicSettings } from "@/features/settings/lib/use-clinic-settings"
import { localizedPulseMetrics } from "@/lib/i18n/localized-seed"
import { dashboardMetrics } from "@/lib/mock-data"
import type { BillingInvoice, PulseMetric } from "@/types/domain"

/**
 * The dashboard's four headline numbers.
 *
 * Real ones for a real clinic, the demo set otherwise — the same rule as
 * everywhere else, decided by whether the clinic has patients rather than by a
 * setting.
 *
 * `live` comes back with them because the rest of the dashboard needs to know:
 * the "Observations" card beside these is three paragraphs of written-in
 * analysis, true of nobody, and it has no place next to figures that are real.
 */
export function usePulseMetrics(): { metrics: PulseMetric[]; live: boolean } {
  const { t, locale, formatMoney } = useLocale()
  const { appointments } = useScheduleDay()
  const { settings } = useClinicSettings()

  const [live, setLive] = useState(false)
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])

  // Re-read the ledger when it changes, so a payment taken on the Finances
  // page moves the revenue figure without a reload.
  const [ledgerVersion, setLedgerVersion] = useState(0)
  useEffect(() => {
    const bump = () => setLedgerVersion((v) => v + 1)
    window.addEventListener(BILLING_STORE_EVENT, bump)
    return () => window.removeEventListener(BILLING_STORE_EVENT, bump)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([clinicHasPatients(), fetchInvoices(formatMoney)]).then(
      ([hasPatients, result]) => {
        if (cancelled || !hasPatients) return
        setLive(true)
        if (result.source === "live") setInvoices(result.invoices)
      },
    )
    return () => {
      cancelled = true
    }
  }, [formatMoney, ledgerVersion])

  return useMemo(() => {
    if (!live) {
      return { metrics: localizedPulseMetrics(dashboardMetrics, locale, (k) => t(k)), live: false }
    }
    const computed = computePulseMetrics(appointments, invoices, settings, formatMoney)
    // Only the label is translated. `localizedPulseMetrics` also substitutes the
    // value and the change from the dictionary, which is right for the demo
    // figures — they live there — and would replace a real ₪0 with "₪74.2k".
    return {
      metrics: computed.map((m) => {
        const key = `metric.${m.id}.label`
        const label = t(key)
        return { ...m, label: label === key ? m.label : label }
      }),
      live: true,
    }
  }, [live, invoices, appointments, settings, formatMoney, locale, t])
}
