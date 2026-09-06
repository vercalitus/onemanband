"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { createTranslator } from "@/lib/i18n/dictionary"
import { onInvoicePaid } from "@/features/automations/lib/events"
import { clearRemoteClaim } from "@/features/automations/lib/remote-responses"
import {
  createInvoice,
  fetchInvoices,
  fetchUninvoicedVisits,
  settleInvoiceRow,
} from "@/features/finances/lib/finance-repository"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { planPaidVisitDocument } from "@/features/finances/lib/plan-tax-document"
import { fileTaxDocument } from "@/features/finances/lib/tax-documents"
import {
  seedIntegration,
  seedInvoices,
  seedUninvoicedVisits,
} from "@/lib/mock-finances"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { getTreatmentPriceIls } from "@/lib/clinic-settings-storage"
import type {
  BillingInvoice,
  PaymentMethod,
  ProviderIntegration,
  UninvoicedVisit,
} from "@/types/domain"

const STORAGE_KEY_INVOICES = "billing.invoices.v1"
const STORAGE_KEY_VISITS = "billing.uninvoiced.v1"
const STORAGE_KEY_INTEGRATION = "billing.integration.v1"

/**
 * Translator pinned to Hebrew, for text that ends up on a tax document rather
 * than on the practitioner's screen. See `DOCUMENT_LANGUAGE` in
 * `plan-tax-document.ts` for why the document never follows the UI locale.
 */
const he = createTranslator("he")

/**
 * Centralised billing store for the Financial OS page. State is hydrated
 * from LocalStorage on mount and re-persisted on every mutation, so user
 * actions (generate / mark paid / retry sync) survive a refresh and the UI
 * reflects them immediately. When we wire Supabase later, the seed becomes
 * the server fetch and the same shape stays.
 */
export function useBilling() {
  const { formatMoney, t } = useLocale()
  /**
   * The clinic's own patients, not the demo list.
   *
   * This lookup fills the customer card at the bookkeeping provider — name,
   * email, phone, address. Against the mock list a real patient simply is not
   * found, and the document goes out with no email on it, so nothing is
   * delivered and nobody is told why.
   */
  const patients = useMergedPatients()
  const [invoices, setInvoices] = useState<BillingInvoice[]>(seedInvoices)
  const [uninvoicedVisits, setUninvoicedVisits] = useState<UninvoicedVisit[]>(
    seedUninvoicedVisits,
  )
  const [integration, setIntegration] = useState<ProviderIntegration>(seedIntegration)
  const [hydrated, setHydrated] = useState(false)
  /** True once the ledger is coming from Postgres rather than localStorage. */
  const [live, setLive] = useState(false)

  /**
   * Replace the demo ledger with the clinic's real one, if there is one.
   *
   * Same rule as patients and the diary: an empty table means nothing has been
   * billed yet, and an empty billing page is indistinguishable from a broken
   * one, so the demo figures stay until a real invoice exists. The first one
   * retires them.
   */
  const refreshLive = useCallback(() => {
    void Promise.all([fetchInvoices(formatMoney), clinicHasPatients()]).then(
      ([result, hasPatients]) => {
      if (result.source !== "live" || !result.invoices.length) {
        if (result.source === "unavailable" && process.env.NODE_ENV === "development") {
          console.warn(`[billing] falling back to mock data: ${result.reason}`)
        }
        // Real patients and nothing billed is a real state: the page should
        // say the ledger is empty, not invent debts owed by people who are not
        // in the clinic's records.
        if (result.source === "live" && hasPatients) {
          setLive(true)
          setInvoices([])
          void fetchUninvoicedVisits(formatMoney, (type) =>
            getTreatmentPriceIls(type) ?? 0,
          ).then(setUninvoicedVisits)
        }
        return
      }
      setLive(true)
      setInvoices(result.invoices)
      // And the visits nobody has billed yet, which are the other half of this
      // page. Derived from real appointments once there are any, so the demo
      // "needs invoice" rows do not sit beside a real debt.
      void fetchUninvoicedVisits(formatMoney, (type) =>
        getTreatmentPriceIls(type) ?? 0,
      ).then(setUninvoicedVisits)
      },
    )
  }, [formatMoney])

  useEffect(() => refreshLive(), [refreshLive])

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
    // Once the ledger is live, Postgres is the record and this cache would
    // only be a second, staler copy — one that hydration would then show for a
    // moment on the next load before the real figures arrive.
    if (live) return
    try {
      window.localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices))
    } catch {}
  }, [invoices, hydrated, live])

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
          // Nothing has been filed yet: an invoice exists here, but the tax
          // document only comes into being when the money does. `synced` would
          // have claimed a document that is not there.
          syncStatus: "pending",
        }
        setInvoices((current) => [newInvoice, ...current])
        // Persist it, and take back the row the database made — its id is the
        // one everything else will key on.
        if (live) {
          void createInvoice(
            {
              patientId: visit.patientId,
              amount: unit,
              treatmentType: visit.treatmentType,
              issuedAt,
              dueAt: dueDate.toISOString().slice(0, 10),
            },
            formatMoney,
          ).then((written) => {
            if (written.ok) {
              setInvoices((current) =>
                [written.invoice, ...current.filter((inv) => inv.id !== id)],
              )
            }
          })
        }
        return prev.filter((v) => v.id !== visitId)
      })
    },
    [integration.provider, formatMoney, live],
  )

  /**
   * Settle an invoice: record how the patient paid, then file the tax document.
   *
   * These are one action because they are one event. A single-practitioner
   * clinic bills on a cash basis, so the document is a חשבונית מס קבלה —
   * invoice and receipt together — and it only comes into existence once the
   * money has actually arrived. Marking paid without filing would leave income
   * undocumented; filing without payment would invent a tax event.
   *
   * The invoice is marked paid whatever the filing does. A failed filing is a
   * bookkeeping problem to retry, not a reason to pretend the patient did not
   * pay — `syncStatus` carries that separately.
   */
  const settleInvoice = useCallback(
    async (
      invoiceId: string,
      payment: { amount: number; method: PaymentMethod; date: string },
    ) => {
      const invoice = invoices.find((inv) => inv.id === invoiceId)
      if (!invoice) return { ok: false, message: t("billing.payment.error.missing") }

      const patient = patients.find((p) => p.id === invoice.patientId)
      const request = planPaidVisitDocument({
        invoice,
        // Deliberately not `t()` — that follows the practitioner's UI language
        // and would print an English line item on a Hebrew tax document.
        treatmentLabel: he(`billing.treatment.${invoice.treatmentType}`),
        patient: {
          id: invoice.patientId,
          fullName: patient?.fullName ?? invoice.patientName,
          email: patient?.email,
          phone: patient?.phone,
          address: patient?.address,
        },
        payment,
        // Overridden server-side; the deploy decides, not the browser.
        draft: true,
      })

      const outcome = await fileTaxDocument(request, { invoiceId })

      const settled = (patch: Partial<BillingInvoice>) => {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId
              ? {
                  ...inv,
                  status: "paid",
                  paymentStatus: "paid",
                  paidAt: payment.date,
                  amount: payment.amount,
                  displayAmount: formatMoney(payment.amount),
                  paymentMethod: payment.method,
                  ...patch,
                }
              : inv,
          ),
        )
        // The patient has paid — stop chasing them, whatever the filing did.
        onInvoicePaid(invoiceId)
        // And close the claim where it actually lives. The patient tapped
        // "I've already paid" on their own phone, so the open row is in the
        // database, not in this browser.
        clearRemoteClaim(invoiceId)
        setIntegration((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }))
        // Write the settlement down. The filing outcome goes with it, whatever
        // it was: an invoice can be paid and its document missing, and that
        // pair has to survive a refresh or the money is recorded with no
        // receipt and no trace of why.
        if (live) {
          void settleInvoiceRow(
            {
              id: invoiceId,
              amount: payment.amount,
              method: payment.method,
              paidAt: payment.date,
              syncStatus: (patch.syncStatus as BillingInvoice["syncStatus"]) ?? "pending",
              taxDocument: patch.taxDocument,
              syncError: patch.syncError,
            },
            formatMoney,
          )
        }
      }

      if (outcome.status === "filed") {
        settled({
          syncStatus: outcome.document.provider === "simulated" ? "simulated" : "synced",
          taxDocument: outcome.document,
          syncError: undefined,
        })
        if (outcome.document.provider === "simulated") {
          return { ok: true, message: t("billing.payment.result.simulated") }
        }
        if (outcome.document.draft) {
          return { ok: true, message: t("billing.payment.result.draft") }
        }
        return {
          ok: true,
          message: t("billing.payment.result.filed", {
            number: String(outcome.document.documentNumber ?? "—"),
          }),
        }
      }

      if (outcome.status === "blocked") {
        settled({ syncStatus: "failed", syncError: outcome.message })
        return { ok: false, blocked: true, message: t("billing.payment.result.blocked") }
      }

      settled({ syncStatus: "failed", syncError: outcome.message })
      return { ok: false, message: t("billing.payment.result.failed", { reason: outcome.message }) }
    },
    [invoices, t, formatMoney, live, patients],
  )

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
   * Retry filing for an invoice whose document never made it.
   *
   * Genuinely re-files — it does not flip a badge on a timer. Nothing here
   * decides whether the retry is safe: `fileTaxDocument` refuses when a
   * previous attempt's outcome is unknown, which is the whole point of that
   * guard. A retry that could not know is a duplicate tax invoice waiting to
   * happen.
   *
   * Only settled invoices can be retried. An unpaid visit has no document to
   * file in the first place.
   */
  const retrySync = useCallback(
    async (invoiceId: string) => {
      const invoice = invoices.find((inv) => inv.id === invoiceId)
      if (!invoice?.paymentMethod || !invoice.paidAt) return

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, syncStatus: "pending" } : inv)),
      )

      const outcome = await settleInvoice(invoiceId, {
        amount: invoice.amount,
        method: invoice.paymentMethod,
        date: invoice.paidAt,
      })

      if (!outcome.ok) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, syncStatus: "failed", syncError: outcome.message } : inv,
          ),
        )
      }
    },
    [invoices, settleInvoice],
  )

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
    settleInvoice,
    sendReminder,
    retrySync,
    /** True when these figures are the clinic's, not the demonstration's. */
    live,
  }
}
