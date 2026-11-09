"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, FileDown, FileText, Search } from "lucide-react"

import {
  PagePlate,
  PlateDebt,
  PlateDivider,
  PlateFact,
} from "@/components/layout/page-plate"
import { useLocale } from "@/components/providers/locale-provider"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidePanel } from "@/components/ui/side-panel"
import { StateLegend } from "@/components/ui/state-mark"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BillingToast } from "@/features/finances/components/billing-toast"
import { HistoryRow } from "@/features/finances/components/history-row"
import { InsightsPanel } from "@/features/finances/components/insights-panel"
import { IntegrationStatus } from "@/features/finances/components/integration-status"
import { KpiCard } from "@/features/finances/components/kpi-card"
import {
  PendingInvoiceRow,
  PendingVisitRow,
  ROW_BUTTON,
} from "@/features/finances/components/pending-row"
import { RecordPaymentDialog } from "@/features/finances/components/record-payment-dialog"
import {
  computeCollectionRate,
  computeMonthlyDeltaPct,
  computeMonthlyRevenue,
  computeOutstanding,
  computePatientSnapshots,
} from "@/features/finances/lib/derive-billing"
import { downloadHistoryCsv, printHistoryForPdf } from "@/features/finances/lib/export-history"
import { useBilling } from "@/features/finances/lib/use-billing"
import { PREVIOUS_MONTH_REVENUE } from "@/lib/mock-finances"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const { t, formatMoney } = useLocale()
  const allPatients = useMergedPatients()
  const {
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
    live: liveLedger,
  } = useBilling()

  /** The invoice whose payment is being recorded, if any. */
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState("")
  const [pendingQuery, setPendingQuery] = useState("")
  const [billingToastOpen, setBillingToastOpen] = useState(false)
  const [billingToastMessage, setBillingToastMessage] = useState("")

  /**
   * `?settle=<invoiceId>` opens the payment dialog straight away.
   *
   * This is where the WhatsApp notice about a patient's payment claim lands.
   * The link deliberately does not *issue* anything: issuing a tax document is
   * irreversible, so it stays behind the session, and the link only saves the
   * practitioner from hunting for the row. One tap either way, but the tap
   * happens inside an authenticated app.
   *
   * Read from `window` rather than `useSearchParams` so this page needs no
   * Suspense boundary; it is a client page and the query is only ever read
   * after mount anyway.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("settle")
    if (!requested) return
    // Only if it is still open — a link opened twice must not reopen a visit
    // that has already been settled and filed.
    const invoice = invoices.find((inv) => inv.id === requested)
    if (invoice && invoice.status !== "paid") setSettlingId(requested)
  }, [invoices])

  const outstanding = useMemo(() => computeOutstanding(invoices), [invoices])
  const monthlyRevenue = useMemo(() => computeMonthlyRevenue(invoices), [invoices])
  // No invented previous month once the ledger is real. A clinic in its first
  // month here has nothing to compare against, and saying so beats an arrow.
  const monthlyDelta = useMemo(
    () => computeMonthlyDeltaPct(monthlyRevenue, liveLedger ? null : undefined),
    [monthlyRevenue, liveLedger],
  )
  const collectionRate = useMemo(() => computeCollectionRate(invoices), [invoices])
  const snapshots = useMemo(
    () => computePatientSnapshots(invoices, formatMoney, allPatients),
    [invoices, formatMoney, allPatients],
  )

  const balanceByPatient = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of snapshots) m.set(s.patientId, s.balance)
    return m
  }, [snapshots])

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    if (!q) return historyInvoices
    return historyInvoices.filter((inv) => {
      return (
        inv.patientName.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        (inv.paidAt ?? "").includes(q) ||
        (inv.issuedAt ?? "").includes(q)
      )
    })
  }, [historyInvoices, historyQuery])

  const filteredPendingVisits = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase()
    if (!q) return uninvoicedVisits
    return uninvoicedVisits.filter((v) => {
      return (
        v.patientName.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        v.visitDate.toLowerCase().includes(q)
      )
    })
  }, [uninvoicedVisits, pendingQuery])

  const filteredPendingInvoices = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase()
    if (!q) return pendingInvoices
    return pendingInvoices.filter((inv) => {
      return (
        inv.patientName.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        (inv.issuedAt ?? "").toLowerCase().includes(q)
      )
    })
  }, [pendingInvoices, pendingQuery])

  const pendingCount = uninvoicedVisits.length + pendingInvoices.length
  const filteredPendingCount = filteredPendingVisits.length + filteredPendingInvoices.length

  const searchField = (value: string, onChange: (v: string) => void, label: string) => (
    <div className="relative w-full min-w-0 sm:max-w-md">
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="ps-10"
        aria-label={label}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* The plate carries the three figures the page already computes. The
          debt is outlined in orange only while there is one to collect. */}
      <PagePlate>
        <KpiCard
          display
          label={t("finances.kpi.monthlyRevenue")}
          value={formatMoney(monthlyRevenue)}
          delta={monthlyDelta}
          context={
            liveLedger
              ? undefined
              : t("finances.kpi.vsLastMonth", { amount: formatMoney(PREVIOUS_MONTH_REVENUE) })
          }
        />
        <PlateDivider />
        {outstanding > 0 ? (
          <PlateDebt
            amount={formatMoney(outstanding)}
            label={t("finances.kpi.outstanding")}
            sub={t("finances.kpi.invoicesAwaiting", { count: pendingInvoices.length })}
          />
        ) : (
          <PlateFact label={t("finances.kpi.outstanding")}>{formatMoney(outstanding)}</PlateFact>
        )}
        <KpiCard
          label={t("finances.kpi.collectionRate")}
          value={collectionRate === null ? "—" : `${collectionRate}%`}
          context={t("finances.kpi.paidCollectible")}
        />
      </PagePlate>

      <h1 className="sr-only">{t("finances.card.invoices")}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-md border border-hair bg-paper">
          <Tabs defaultValue="pending" className="gap-0">
            <div className="flex min-h-16 items-end gap-3 border-b border-hair px-4 sm:px-6">
              <TabsList variant="line" className="h-auto w-auto flex-1 gap-4 pb-0">
                <TabsTrigger value="pending" className="min-h-14 px-1">
                  {t("finances.tab.pending")}
                  <span className="text-sm font-medium tabular-nums text-mute">{pendingCount}</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="min-h-14 px-1">
                  {t("finances.tab.history")}
                  <span className="text-sm font-medium tabular-nums text-mute">
                    {historyInvoices.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <Button
                type="button"
                variant="outline"
                className={cn(ROW_BUTTON, "mb-2.5 self-center")}
                onClick={() => setInsightsOpen(true)}
              >
                <BarChart3 aria-hidden />
                {t("finances.advancedInsights")}
              </Button>
            </div>

            <TabsContent value="pending">
              <div className="border-b border-hair-soft px-4 py-4 sm:px-6">
                {searchField(pendingQuery, setPendingQuery, t("finances.search.pending"))}
              </div>

              <div>
                {filteredPendingVisits.map((visit) => (
                  <PendingVisitRow
                    key={visit.id}
                    visit={visit}
                    patientBalance={balanceByPatient.get(visit.patientId) ?? 0}
                    onGenerate={() => generateInvoice(visit.id)}
                  />
                ))}
                {filteredPendingInvoices.map((inv) => (
                  <PendingInvoiceRow
                    key={inv.id}
                    invoice={inv}
                    patientBalance={balanceByPatient.get(inv.patientId) ?? 0}
                    onSendReminder={() => sendReminder(inv.id)}
                    onMarkPaid={() => setSettlingId(inv.id)}
                  />
                ))}
                {pendingCount === 0 && (
                  <EmptyState title={t("finances.empty.caughtUp.title")} body={t("finances.empty.caughtUp.body")} />
                )}
                {pendingCount > 0 && filteredPendingCount === 0 && (
                  <EmptyState
                    title={t("finances.empty.noMatches.title")}
                    body={t("finances.empty.pendingNoMatch", { q: pendingQuery.trim() })}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="flex flex-col gap-3 border-b border-hair-soft px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                {searchField(historyQuery, setHistoryQuery, t("finances.search.history"))}
                <div className="flex shrink-0 flex-wrap gap-2 sm:ms-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className={ROW_BUTTON}
                    onClick={() => downloadHistoryCsv(filteredHistory)}
                  >
                    <FileDown aria-hidden />
                    {t("finances.export.csv")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={ROW_BUTTON}
                    onClick={() => printHistoryForPdf(filteredHistory)}
                  >
                    <FileText aria-hidden />
                    {t("finances.export.pdf")}
                  </Button>
                </div>
              </div>

              <div>
                {filteredHistory.length === 0 ? (
                  <EmptyState
                    title={t("finances.empty.noMatches.title")}
                    body={
                      historyQuery.trim()
                        ? t("finances.empty.historyNoMatch", { q: historyQuery.trim() })
                        : t("finances.empty.historyEmpty")
                    }
                  />
                ) : (
                  filteredHistory.map((inv) => (
                    <HistoryRow
                      key={inv.id}
                      invoice={inv}
                      patientBalance={balanceByPatient.get(inv.patientId) ?? 0}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <StateLegend
            className="border-t border-hair px-4 py-3 sm:px-6"
            items={[
              { state: "done", label: t("history.status.paid") },
              { state: "plan", label: t("finances.pending.awaiting") },
              { state: "cancel", label: t("history.status.void") },
            ]}
          />
        </section>

        <aside className="rounded-md border border-hair bg-paper p-5">
          <h2 className="mb-3 text-[17px] font-bold text-ink">{t("finances.card.integration")}</h2>
          <IntegrationStatus
            integration={integration}
            failedInvoices={failedSyncInvoices}
            onRetrySync={retrySync}
          />
        </aside>
      </div>

      <SidePanel
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        title={t("finances.side.title")}
        description={t("finances.side.description")}
      >
        <InsightsPanel invoices={invoices} />
      </SidePanel>

      {/* Looked up in `invoices`, not `pendingInvoices`: a settled invoice
          leaves the pending list immediately, and sourcing it from there would
          unmount the dialog before it can report whether a tax document was
          actually filed — which is the only part of this the clinic must see. */}
      <RecordPaymentDialog
        invoice={invoices.find((inv) => inv.id === settlingId) ?? null}
        open={settlingId !== null}
        onOpenChange={(open) => setSettlingId(open ? settlingId : null)}
        onConfirm={async (payment) => {
          if (!settlingId) return { ok: false, message: "" }
          const invoice = invoices.find((inv) => inv.id === settlingId)
          const outcome = await settleInvoice(settlingId, payment)
          // Success is confirmed in the page and the dialog closes itself.
          // A failure keeps the dialog open with the reason still on screen.
          if (outcome.ok && invoice) {
            setBillingToastMessage(
              t("finances.toast.markPaid", { patientName: invoice.patientName }),
            )
            setBillingToastOpen(true)
          }
          return outcome
        }}
      />

      <BillingToast
        open={billingToastOpen}
        message={billingToastMessage}
        onOpenChange={setBillingToastOpen}
      />
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[17px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-mute">{body}</p>
    </div>
  )
}
