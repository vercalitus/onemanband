"use client"

import { useMemo, useState } from "react"
import {
  BarChart3,
  CircleDollarSign,
  Percent,
  Plug,
  Receipt,
  Search,
  Wallet,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidePanel } from "@/components/ui/side-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HistoryRow } from "@/features/finances/components/history-row"
import { InsightsPanel } from "@/features/finances/components/insights-panel"
import { IntegrationStatus } from "@/features/finances/components/integration-status"
import { KpiCard } from "@/features/finances/components/kpi-card"
import {
  PendingInvoiceRow,
  PendingVisitRow,
} from "@/features/finances/components/pending-row"
import {
  computeCollectionRate,
  computeMonthlyDeltaPct,
  computeMonthlyRevenue,
  computeOutstanding,
  computePatientSnapshots,
} from "@/features/finances/lib/derive-billing"
import { useBilling } from "@/features/finances/lib/use-billing"
import {
  darkCardHeaderClass,
  elevatedCardBodyClass,
  elevatedCardClass,
} from "@/lib/clinic-card-styles"
import { formatCurrency, PREVIOUS_MONTH_REVENUE } from "@/lib/mock-finances"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const {
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
  } = useBilling()

  const [insightsOpen, setInsightsOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState("")

  const outstanding = useMemo(() => computeOutstanding(invoices), [invoices])
  const monthlyRevenue = useMemo(() => computeMonthlyRevenue(invoices), [invoices])
  const monthlyDelta = useMemo(() => computeMonthlyDeltaPct(monthlyRevenue), [monthlyRevenue])
  const collectionRate = useMemo(() => computeCollectionRate(invoices), [invoices])
  const snapshots = useMemo(() => computePatientSnapshots(invoices), [invoices])

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

  const pendingCount = uninvoicedVisits.length + pendingInvoices.length

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* KPI strip */}
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Outstanding balance"
          value={formatCurrency(outstanding)}
          icon={Wallet}
          tone="warning"
          context={`${pendingInvoices.length} invoice${pendingInvoices.length === 1 ? "" : "s"} awaiting payment`}
        />
        <KpiCard
          label="Monthly revenue"
          value={formatCurrency(monthlyRevenue)}
          icon={CircleDollarSign}
          tone="success"
          delta={monthlyDelta}
          context={`vs ${formatCurrency(PREVIOUS_MONTH_REVENUE)} last month`}
        />
        <KpiCard
          label="Collection rate"
          value={collectionRate === null ? "—" : `${collectionRate}%`}
          icon={Percent}
          tone="neutral"
          context="Paid / collectible"
          footer={
            collectionRate === null ? null : (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
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
          Advanced Insights
        </button>
      </div>

      {/* Main: invoices + integration status */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className={elevatedCardClass}>
          <CardHeader className={cn(darkCardHeaderClass, "gap-3 py-4")}>
            <div className="flex items-center gap-2.5">
              <Receipt className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
              <CardTitle className="text-xl font-bold tracking-tight text-white">Invoices</CardTitle>
              <span className="text-xs font-medium text-white/50">
                {pendingCount === 0 ? "Nothing pending" : `${pendingCount} pending action`}
              </span>
            </div>
          </CardHeader>
          <CardContent className={cn(elevatedCardBodyClass, "bg-slate-50/60 py-6")}>
            <Tabs defaultValue="pending" className="gap-5">
              <TabsList className="bg-white shadow-[0_1px_3px_-1px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                <TabsTrigger value="pending">
                  Pending action
                  <span className="ml-1.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    {pendingCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="history">
                  History
                  <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    {historyInvoices.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-2.5">
                {uninvoicedVisits.map((visit) => (
                  <PendingVisitRow
                    key={visit.id}
                    visit={visit}
                    patientBalance={balanceByPatient.get(visit.patientId) ?? 0}
                    onGenerate={() => generateInvoice(visit.id)}
                  />
                ))}
                {pendingInvoices.map((inv) => (
                  <PendingInvoiceRow
                    key={inv.id}
                    invoice={inv}
                    patientBalance={balanceByPatient.get(inv.patientId) ?? 0}
                    onSendReminder={() => sendReminder(inv.id)}
                    onMarkPaid={() => markInvoicePaid(inv.id)}
                  />
                ))}
                {pendingCount === 0 && (
                  <EmptyState
                    title="Nothing pending"
                    body="All visits are invoiced and every issued invoice has been paid."
                  />
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-3">
                <div className="relative max-w-md">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder="Search by patient, invoice ID, or date"
                    className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-sm"
                    aria-label="Search invoice history"
                  />
                </div>

                <div className="space-y-2.5">
                  {filteredHistory.length === 0 ? (
                    <EmptyState
                      title="No matches"
                      body={
                        historyQuery
                          ? `Nothing in history matches "${historyQuery.trim()}".`
                          : "No history yet."
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
                  Integration
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
        title="Advanced Insights"
        description="Revenue breakdown and trends across treatment types."
      >
        <InsightsPanel invoices={invoices} />
      </SidePanel>
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
