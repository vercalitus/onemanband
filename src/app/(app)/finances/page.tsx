import { FileText, TrendingUp, Users } from "lucide-react"

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
import { debtorSnapshot, invoiceArchive } from "@/lib/mock-data"

export default function BillingPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
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
              <div
                key={debtor.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{debtor.name}</p>
                  <p className="mt-1 text-xs text-slate-400">Last visit {debtor.lastVisit}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                  <TableCell className="whitespace-nowrap font-medium text-slate-900">{invoice.id}</TableCell>
                  <TableCell>{invoice.patient}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{invoice.status}</Badge>
                  </TableCell>
                  <TableCell>{invoice.provider}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono tabular-nums text-slate-900">{invoice.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
