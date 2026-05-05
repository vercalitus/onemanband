import { FileText, TrendingUp, Users } from "lucide-react"

import { debtorSnapshot, invoiceArchive } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { getNavItemByHref, navBadgeCaption } from "@/lib/navigation"

export default function FinancesPage() {
  const nav = getNavItemByHref("/finances")!

  return (
    <div className="space-y-8">
      <section className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            {navBadgeCaption(nav.description)}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-slate-900">{nav.label}</h1>
        </div>
        <div className="inline-flex items-center rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.08)]">
          Reconciliation surface
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={elevatedCardClass}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <TrendingUp className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">Income Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={`${elevatedCardBodyClass} grid gap-4 sm:grid-cols-3`}>
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">This week</p>
              <p className="mt-3 font-mono text-3xl font-semibold tracking-[-0.05em] tabular-nums text-slate-900">$18.4k</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Outstanding</p>
              <p className="mt-3 font-mono text-3xl font-semibold tracking-[-0.05em] tabular-nums text-slate-900">$2.1k</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Collection rate</p>
              <p className="mt-3 font-mono text-3xl font-semibold tracking-[-0.05em] tabular-nums text-slate-900">93%</p>
            </div>
          </CardContent>
        </Card>

        <Card className={elevatedCardClass}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <Users className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">Debtors</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={`${elevatedCardBodyClass} space-y-3`}>
            {debtorSnapshot.map((debtor) => (
              <div key={debtor.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4">
                <div>
                  <p className="font-medium text-slate-900">{debtor.name}</p>
                  <p className="mt-1 text-xs text-slate-400">Last visit {debtor.lastVisit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{debtor.status}</Badge>
                  <span className="font-mono text-sm font-medium tabular-nums text-slate-900">{debtor.balance}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <FileText className="size-5 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-xl font-bold tracking-tight text-white">Invoice Archive</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={elevatedCardBodyClass}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceArchive.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium text-slate-900">{invoice.id}</TableCell>
                  <TableCell>{invoice.patient}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{invoice.status}</Badge>
                  </TableCell>
                  <TableCell>{invoice.provider}</TableCell>
                  <TableCell className="font-mono tabular-nums text-slate-900">{invoice.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
