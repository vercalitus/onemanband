"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  seedIntegration,
  seedInvoices,
  seedUninvoicedVisits,
} from "@/lib/mock-finances"
import { getTreatmentPriceIls } from "@/lib/clinic-settings-storage"
import type {
  BillingInvoice,
  ProviderIntegration,
  UninvoicedVisit,
} from "@/types/domain"

const STORAGE_KEY_INVOICES = "billing.invoices.v1"
const STORAGE_KEY_VISITS = "billing.uninvoiced.v1"
const STORAGE_KEY_INTEGRATION = "billing.integration.v1"

/**
 * Centralised billing store for the Financial OS page. State is hydrated
 * from LocalStorage on mount and re-persisted on every mutation, so user
 * actions (generate / mark paid / retry sync) survive a refresh and the UI
 * reflects them immediately. When we wire Supabase later, the seed becomes
 * the server fetch and the same shape stays.
 */
export function useBilling() {
  const { formatMoney } = useLocale()
  const [invoices, setInvoices] = useState<BillingInvoice[]>(seedInvoices)
  const [uninvoicedVisits, setUninvoicedVisits] = useState<UninvoicedVisit[]>(
    seedUninvoicedVisits,
  )
  const [integration, setIntegration] = useState<ProviderIntegration>(seedIntegration)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate persisted state on mount. Done in an effect (not initialiser) so
  // SSR markup matches the first client render and avoids hydration warnings.
  useEffect(() => {
    try {
      const rawInv = window.localStorage.getItem(STORAGE_KEY_INVOICES)
      if (rawInv) {
        const parsed = JSON.parse(rawInv) as BillingInvoice[]
        if (Array.isArray(parsed) && parsed.length > 0) setInvoices(parsed)
      }
      const rawVisits = window.localStorage.getItem(STORAGE_KEY_VISITS)
      if (rawVisits) {
        const parsed = JSON.parse(rawVisits) as UninvoicedVisit[]
        if (Array.isArray(parsed)) setUninvoicedVisits(parsed)
      }
      const rawIntegration = window.localStorage.getItem(STORAGE_KEY_INTEGRATION)
      if (rawIntegration) {
        const parsed = JSON.parse(rawIntegration) as ProviderIntegration
        if (parsed && parsed.provider) setIntegration(parsed)
      }
    } catch {
      // LocalStorage may be unavailable (private mode / quota); fall back to seeds.
    } finally {
      setHydrated(true)
    }
  }, [])

  // Persist on every mutation. Guarded by `hydrated` so we don't overwrite
  // user state with seed defaults on first paint.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices))
    } catch {}
  }, [invoices, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(uninvoicedVisits))
    } catch {}
  }, [uninvoicedVisits, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY_INTEGRATION, JSON.stringify(integration))
    } catch {}
  }, [integration, hydrated])

  const syncVisitPricesFromSettings = useCallback(() => {
    setUninvoicedVisits((prev) =>
      prev.map((v) => {
        const p = getTreatmentPriceIls(v.treatmentType)
        if (p == null) return v
        return { ...v, suggestedAmount: p, suggestedDisplayAmount: formatMoney(p) }
      }),
    )
  }, [formatMoney])

  useEffect(() => {
    if (!hydrated) return
    syncVisitPricesFromSettings()
    window.addEventListener("clinic-settings-saved", syncVisitPricesFromSettings)
    return () => window.removeEventListener("clinic-settings-saved", syncVisitPricesFromSettings)
  }, [hydrated, syncVisitPricesFromSettings])

  /** Keep serialized display strings aligned with the shekel formatter. */
  useEffect(() => {
    if (!hydrated) return
    setInvoices((prev) =>
      prev.map((inv) => ({ ...inv, displayAmount: formatMoney(inv.amount) })),
    )
    setUninvoicedVisits((prev) =>
      prev.map((v) => ({ ...v, suggestedDisplayAmount: formatMoney(v.suggestedAmount) })),
    )
  }, [hydrated, formatMoney])

  /**
   * Convert an uninvoiced visit into an "issued" invoice. The visit then
   * disappears from the Pending tab and a new row joins the Pending invoices
   * list (it's "issued" but not "paid").
   */
  const generateInvoice = useCallback(
    (visitId: string) => {
      setUninvoicedVisits((prev) => {
        const visit = prev.find((v) => v.id === visitId)
        if (!visit) return prev
        const id = `INV-${Math.floor(2400 + Math.random() * 600)}`
        const issuedAt = new Date().toISOString().slice(0, 10)
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 14)
        const unit = getTreatmentPriceIls(visit.treatmentType) ?? visit.suggestedAmount
        const newInvoice: BillingInvoice = {
          id,
          patientId: visit.patientId,
          patientName: visit.patientName,
          issuedAt,
          dueAt: dueDate.toISOString().slice(0, 10),
          paidAt: null,
          amount: unit,
          displayAmount: formatMoney(unit),
          status: "issued",
          paymentStatus: "pending",
          treatmentType: visit.treatmentType,
          provider: integration.provider,
          syncStatus: "synced",
        }
        setInvoices((current) => [newInvoice, ...current])
        return prev.filter((v) => v.id !== visitId)
      })
    },
    [integration.provider, formatMoney],
  )

  /**
   * Mark an issued/overdue invoice as paid. Moves it from Pending to History
   * in the UI immediately.
   */
  const markInvoicePaid = useCallback((invoiceId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: "paid", paymentStatus: "paid", paidAt: today }
          : inv,
      ),
    )
  }, [])

  /**
   * Send a reminder for an issued invoice. There's no real channel yet, but
   * we record a "reminded" timestamp on the invoice so the UI can swap the
   * button label / disable double-clicks. We piggyback on `paidAt` being
   * separate from anything reminder-related — store reminded as the
   * `issuedAt` does not change.
   *
   * In production this dispatches WhatsApp/SMS/Email; for now it bumps a
   * timestamp on the invoice and triggers a transient UI state in the page.
   */
  const sendReminder = useCallback((invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              // Mirror the issuedAt bump-forward semantics — bump issuedAt up
              // to "today" so the row's age starts fresh. Lightweight signal
              // until the real reminders pipeline exists.
              issuedAt: new Date().toISOString().slice(0, 10),
            }
          : inv,
      ),
    )
  }, [])

  /**
   * Retry sync for an invoice that previously failed to sync to the external
   * provider. We optimistically flip to "pending" then to "synced" on a
   * short timer to mimic the real call.
   */
  const retrySync = useCallback((invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, syncStatus: "pending" } : inv)),
    )
    window.setTimeout(() => {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, syncStatus: "synced" } : inv)),
      )
      setIntegration((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }))
    }, 900)
  }, [])

  /** Convenience: list invoices that have ever failed to sync. */
  const failedSyncInvoices = useMemo(
    () => invoices.filter((inv) => inv.syncStatus === "failed"),
    [invoices],
  )

  const pendingInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "issued" || inv.status === "overdue"),
    [invoices],
  )

  const historyInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "paid" || inv.status === "void"),
    [invoices],
  )

  return {
    invoices,
    pendingInvoices,
    historyInvoices,
    uninvoicedVisits,
    integration,
    failedSyncInvoices,
    generateInvoice,
    markInvoicePaid,
    sendReminder,
    retrySync,
  }
}
