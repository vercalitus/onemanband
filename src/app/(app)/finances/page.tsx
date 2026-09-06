"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Banknote,
  FileDown,
  FileText,
  Percent,
  Plug,
  Receipt,
  Search,
  Wallet,
} from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidePanel } from "@/components/ui/side-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BillingToast } from "@/features/finances/components/billing-toast"
import { HistoryRow } from "@/features/finances/components/history-row"
import { InsightsPanel } from "@/features/finances/components/insights-panel"
import { IntegrationStatus } from "@/features/finances/components/integration-status"
import { KpiCard } from "@/features/finances/components/kpi-card"
import {
  PendingInvoiceRow,
  PendingVisitRow,
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
import {
  darkCardHeaderClass,
  elevatedCardBodyClass,
  elevatedCardClass,
} from "@/lib/clinic-card-styles"
import { PREVIOUS_MONTH_REVENUE } from "@/lib/mock-finances"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const { t, formatMoney, isRtl } = useLocale()
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
  const snapshots = useMemo(() => computePatientSnapshots(invoices, formatMoney), [invoices, formatMoney])

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

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* KPI strip */}
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label={t("finances.kpi.outstanding")}
          value={formatMoney(outstanding)}
          icon={Wallet}
          context={t("finances.kpi.invoicesAwaiting", { count: pendingInvoices.length })}
        />
        <KpiCard
          label={t("finances.kpi.monthlyRevenue")}
          value={formatMoney(monthlyRevenue)}
          icon={Banknote}
          delta={monthlyDelta}
          context={
            liveLedger
              ? undefined
              : t("finances.kpi.vsLastMonth", { amount: formatMoney(PREVIOUS_MONTH_REVENUE) })
          }
          contextMonospace
        />
        <KpiCard
          label={t("finances.kpi.collectionRate")}
          value={collectionRate === null ? "—" : `${collectionRate}%`}
          icon={Percent}
          context={t("finances.kpi.paidCollectible")}
          footer={
            collectionRate === null ? null : (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full bg-sky-500 transition-all",
                    isRtl && "ms-auto",
                  )}
                  style={{ width: `${collectionRate}%` }}
                  aria-hidden
                />
              </div>
            )
          }
        />
      </section>

      {/* Advanced Insights trigger */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setInsightsOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5",
            "text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-700",
          )}
        >
          <BarChart3 className="size-3.5 stroke-[2]" aria-hidden />
          {t("finances.advancedInsights")}
        </button>
      </div>

      {/* Main: invoices + invoicing provider link (no last-sync noise) */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className={elevatedCardClass}>
          <CardHeader className={cn(darkCardHeaderClass, "gap-3 py-4")}>
            <div className="flex items-center gap-2.5">
              <Receipt className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
              <CardTitle className="text-xl font-bold tracking-tight text-white">
                {t("finances.card.invoices")}
              </CardTitle>
              <span className="text-xs font-medium text-white/50">
                {pendingCount === 0
                  ? t("finances.card.pendingSummary.none")
                  : t("finances.card.pendingSummary.some", { count: pendingCount })}
              </span>
            </div>
          </CardHeader>
          <CardContent className={cn(elevatedCardBodyClass, "bg-slate-50/60 py-6")}>
            <Tabs defaultValue="pending" className="gap-5">
              <TabsList className="bg-white shadow-[0_1px_3px_-1px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                <TabsTrigger value="pending">
                  {t("finances.tab.pending")}
                  <span className="ms-1.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    {pendingCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="history">
                  {t("finances.tab.history")}
                  <span className="ms-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    {historyInvoices.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-3">
                <div className="relative max-w-md">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    value={pendingQuery}
                    onChange={(e) => setPendingQuery(e.target.value)}
                    placeholder={t("finances.search.pending")}
                    className="h-10 rounded-xl border-slate-200 bg-white ps-9 text-sm"
                    aria-label={t("finances.search.pending")}
                  />
                </div>

                <div className="space-y-2.5">
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

              <TabsContent value="history" className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="relative min-w-0 max-w-md flex-1">
                    <Search
                      className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <Input
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder={t("finances.search.history")}
                      className="h-10 rounded-xl border-slate-200 bg-white ps-9 text-sm"
                      aria-label={t("finances.search.history")}
                    />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadHistoryCsv(filteredHistory)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2",
                        "text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <FileDown className="size-3.5 stroke-[2]" aria-hidden />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => printHistoryForPdf(filteredHistory)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2",
                        "text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <FileText className="size-3.5 stroke-[2]" aria-hidden />
                      {t("finances.export.pdf")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
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
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-5">
          <Card className={elevatedCardClass}>
            <CardHeader className={cn(darkCardHeaderClass, "py-4")}>
              <div className="flex items-center gap-2.5">
                <Plug className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
                <CardTitle className="text-base font-bold tracking-tight text-white">
                  {t("finances.card.integration")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className={cn(elevatedCardBodyClass, "py-4")}>
              <IntegrationStatus
                integration={integration}
                failedInvoices={failedSyncInvoices}
                onRetrySync={retrySync}
              />
            </CardContent>
          </Card>
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </div>
  )
}
