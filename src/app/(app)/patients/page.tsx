import Link from "next/link"
import { Activity } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { patients } from "@/lib/mock-data"

const statusTone = {
  active: "default",
  frozen: "secondary",
  past: "outline",
} as const

export default function PatientsPage() {
  return (
    <div className="space-y-8">
      <section className="mt-6 flex justify-end">
        <div className="inline-flex items-center rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.08)]">
          {patients.length} records
        </div>
      </section>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Activity className="size-5 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-xl font-bold tracking-tight text-white">Patients</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={`${elevatedCardBodyClass} space-y-4`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input placeholder="Search by patient name, phone, or keyword" className="lg:max-w-md" />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                Active
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                Frozen
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                Past
              </Badge>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 hover:bg-transparent">
                <TableHead>Patient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Signals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => (
                <TableRow
                  key={patient.id}
                  className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/90"
                >
                  <TableCell className="py-4 align-top whitespace-normal">
                    <Link
                      href={`/patients/${patient.id}`}
                      className="block rounded-md py-0.5 text-left transition-colors hover:bg-slate-100/80 hover:text-slate-900"
                    >
                      <span className="font-medium text-slate-900">{patient.fullName}</span>
                      <p className="mt-1 text-xs text-slate-400">{patient.phone}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="py-4 align-middle">
                    <Badge variant={statusTone[patient.status]}>{patient.status}</Badge>
                  </TableCell>
                  <TableCell className="py-4 align-middle font-mono tabular-nums">{patient.lastVisit}</TableCell>
                  <TableCell className="py-4 align-middle font-mono tabular-nums text-slate-900">
                    {patient.balance}
                  </TableCell>
                  <TableCell className="py-4 align-top whitespace-normal">
                    <div className="flex flex-wrap gap-2">
                      {patient.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
