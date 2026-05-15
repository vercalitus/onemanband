"use client"

import Link from "next/link"
import { Activity, Search } from "lucide-react"
import { useMemo, useState } from "react"

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
import { patients, todaySchedule, weeklySchedule } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type FilterKey = "frozen" | "past" | "active" | "relevant"

/** Patient IDs that have any appointment in today's or the week's schedule — treated as having a future visit. */
const patientsWithFutureVisit = new Set<string>([
  ...todaySchedule.map((a) => a.patientId),
  ...weeklySchedule.map((a) => a.patientId),
])

const TODAY = new Date()

/** Days elapsed between an ISO date and today, floored. Negative if the date is in the future. */
function daysSince(iso: string): number {
  const then = new Date(iso)
  const ms = TODAY.getTime() - then.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/** Human-readable relative label kept short to fit the table row. */
function relativeLabel(days: number): string {
  if (days <= 0) return "today"
  if (days === 1) return "1 day ago"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? "1 year ago" : `${years} years ago`
}

/** Short visit date like "2 Apr 2026". */
function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Parse "$120" / "$0" / "$1,250" strings to a number for sorting and badge state. */
function parseBalance(value: string): number {
  const digits = value.replace(/[^0-9.-]/g, "")
  const n = Number.parseFloat(digits)
  return Number.isFinite(n) ? n : 0
}

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "active", label: "Active (future visit)" },
  { id: "relevant", label: "Still relevant" },
  { id: "frozen", label: "Frozen" },
  { id: "past", label: "Past" },
]

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  frozen: "Frozen",
  past: "Past",
}

export default function PatientsPage() {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<Set<FilterKey>>(new Set())

  const rows = useMemo(() => {
    const decorated = patients.map((p) => {
      const days = daysSince(p.lastVisit)
      const balance = parseBalance(p.balance)
      const hasFuture = patientsWithFutureVisit.has(p.id)
      return {
        patient: p,
        days,
        balance,
        hasFuture,
        isRelevant: days <= 365,
      }
    })

    const matchesQuery = (name: string) =>
      query.trim().length === 0 || name.toLowerCase().includes(query.trim().toLowerCase())

    const matchesFilters = (r: (typeof decorated)[number]) => {
      if (active.size === 0) return true
      if (active.has("frozen") && r.patient.status === "frozen") return true
      if (active.has("past") && r.patient.status === "past") return true
      if (active.has("active") && r.patient.status === "active" && r.hasFuture) return true
      if (active.has("relevant") && r.isRelevant) return true
      return false
    }

    return decorated
      .filter((r) => matchesQuery(r.patient.fullName) && matchesFilters(r))
      .sort((a, b) => {
        const debtA = a.balance > 0 ? 1 : 0
        const debtB = b.balance > 0 ? 1 : 0
        if (debtA !== debtB) return debtB - debtA
        const futureA = a.hasFuture ? 1 : 0
        const futureB = b.hasFuture ? 1 : 0
        if (futureA !== futureB) return futureB - futureA
        return b.days < a.days ? 1 : -1
      })
  }, [query, active])

  const toggleFilter = (id: FilterKey) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-8">
      <Card className={elevatedCardClass}>
        <CardHeader className={cn(darkCardHeaderClass, "flex flex-row items-center justify-between gap-3 py-3")}>
          <div className="flex items-center gap-2.5">
            <Activity className="size-5 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-xl font-bold tracking-tight text-white">Patients</CardTitle>
          </div>
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium tabular-nums text-sky-100 ring-1 ring-white/15">
            {rows.length} of {patients.length}
          </span>
        </CardHeader>

        <CardContent className={`${elevatedCardBodyClass} space-y-5`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by patient name"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const on = active.has(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFilter(f.id)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-slate-900 bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                    )}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 hover:bg-transparent">
                <TableHead className="w-[22%]">Patient</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-[22%]">Last visit</TableHead>
                <TableHead className="w-[16%]">Balance</TableHead>
                <TableHead className="w-[28%]">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">
                    No patients match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ patient, days, balance }) => {
                  const isSettled = balance === 0
                  return (
                    <TableRow
                      key={patient.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                    >
                      <TableCell className="py-5 align-middle">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="rounded-md text-left text-[15px] font-medium tracking-tight text-slate-900 transition-colors hover:text-sky-700"
                        >
                          {patient.fullName}
                        </Link>
                      </TableCell>

                      <TableCell className="py-5 align-middle">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-slate-200 bg-slate-50 text-slate-600",
                            patient.status === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                            patient.status === "frozen" && "border-sky-200 bg-sky-50 text-sky-700",
                            patient.status === "past" && "border-slate-200 bg-slate-50 text-slate-500",
                          )}
                        >
                          {STATUS_LABEL[patient.status] ?? patient.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-5 align-middle">
                        <span className="font-mono text-sm tabular-nums text-slate-800">
                          {formatVisitDate(patient.lastVisit)}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">({relativeLabel(days)})</span>
                      </TableCell>

                      <TableCell className="py-5 align-middle">
                        {isSettled ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                            Settled
                          </Badge>
                        ) : (
                          <Badge className="border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                            Debt: {patient.balance}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-5 align-middle">
                        <p
                          className="truncate text-sm text-slate-500"
                          title={patient.medicalHistorySummary}
                        >
                          {patient.medicalHistorySummary}
                        </p>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
