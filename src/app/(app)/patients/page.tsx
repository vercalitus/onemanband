"use client"

import Link from "next/link"
import { Activity, Search, UserPlus } from "lucide-react"
import { useMemo, useState } from "react"

import { useMergedPatients, usePatientExtras } from "@/components/providers/patient-extras-provider"
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
import { todaySchedule, weeklySchedule } from "@/lib/mock-data"
import { AddPatientDialog } from "@/features/patients/components/add-patient-dialog"
import type { PatientSummary } from "@/types/domain"
import { cn } from "@/lib/utils"

type FilterKey = "frozen" | "past" | "active" | "relevant"

const patientsWithFutureVisit = new Set<string>([
  ...todaySchedule.map((a) => a.patientId),
  ...weeklySchedule.map((a) => a.patientId),
])

const TODAY = new Date()

function daysSince(iso: string): number {
  const then = new Date(iso)
  const ms = TODAY.getTime() - then.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function relativeLabel(days: number): string {
  if (days <= 0) return "today"
  if (days === 1) return "1 day ago"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? "1 year ago" : `${years} years ago`
}

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

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

function statusBadgeClasses(status: PatientSummary["status"]) {
  return cn(
    "border-slate-200 bg-slate-50 text-slate-600",
    status === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
    status === "frozen" && "border-sky-200 bg-sky-50 text-sky-700",
    status === "past" && "border-slate-200 bg-slate-50 text-slate-500",
  )
}

function PatientMobileCard({
  patient,
  days,
  balance,
}: {
  patient: PatientSummary
  days: number
  balance: number
}) {
  const isSettled = balance === 0
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_28px_-14px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/patients/${patient.id}`}
          className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-slate-900 transition-colors hover:text-sky-700"
        >
          {patient.fullName}
        </Link>
        <Badge variant="outline" className={cn("shrink-0", statusBadgeClasses(patient.status))}>
          {STATUS_LABEL[patient.status] ?? patient.status}
        </Badge>
      </div>
      <p className="mt-3 font-mono text-xs tabular-nums text-slate-700">
        {formatVisitDate(patient.lastVisit)}{" "}
        <span className="font-sans text-slate-400">({relativeLabel(days)})</span>
      </p>
      <div className="mt-2">
        {isSettled ? (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Settled</Badge>
        ) : (
          <Badge className="border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100">Debt: {patient.balance}</Badge>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">{patient.medicalHistorySummary}</p>
    </div>
  )
}

export default function PatientsPage() {
  const merged = useMergedPatients()
  const { addPatient } = usePatientExtras()
  const [query, setQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set())
  const [addOpen, setAddOpen] = useState(false)

  const rows = useMemo(() => {
    const decorated = merged.map((p) => {
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
      if (activeFilters.size === 0) return true
      if (activeFilters.has("frozen") && r.patient.status === "frozen") return true
      if (activeFilters.has("past") && r.patient.status === "past") return true
      if (activeFilters.has("active") && r.patient.status === "active" && r.hasFuture) return true
      if (activeFilters.has("relevant") && r.isRelevant) return true
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
  }, [query, activeFilters, merged])

  const toggleFilter = (id: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
      <Card className={elevatedCardClass}>
        <CardHeader
          className={cn(darkCardHeaderClass, "flex flex-row flex-wrap items-center justify-between gap-3 py-3")}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Activity className="size-5 shrink-0 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-lg font-bold tracking-tight text-white sm:text-xl">Patients</CardTitle>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white ring-1 ring-white/20">
            {rows.length} of {merged.length}
          </span>
        </CardHeader>

        <CardContent className={`${elevatedCardBodyClass} space-y-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="relative w-full min-w-0 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by patient name"
                className="pl-9"
              />
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {FILTERS.map((f) => {
                const on = activeFilters.has(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFilter(f.id)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
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

          <div className="space-y-3 lg:hidden">
            {rows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                No patients match the current filters.
              </p>
            ) : (
              rows.map(({ patient, days, balance }) => (
                <PatientMobileCard key={patient.id} patient={patient} days={days} balance={balance} />
              ))
            )}
          </div>

          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 hover:bg-transparent">
                  <TableHead className="min-w-[9rem]">Patient</TableHead>
                  <TableHead className="min-w-[6rem]">Status</TableHead>
                  <TableHead className="min-w-[11rem]">Last visit</TableHead>
                  <TableHead className="min-w-[7rem]">Balance</TableHead>
                  <TableHead className="min-w-[14rem] max-w-[min(28rem,28vw)]">Note</TableHead>
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
                            className="block rounded-md text-left text-[15px] font-medium tracking-tight text-slate-900 transition-colors hover:text-sky-700"
                          >
                            {patient.fullName}
                          </Link>
                        </TableCell>

                        <TableCell className="py-5 align-middle">
                          <Badge variant="outline" className={statusBadgeClasses(patient.status)}>
                            {STATUS_LABEL[patient.status] ?? patient.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-5 align-middle">
                          <span className="font-mono text-sm tabular-nums text-slate-800">{formatVisitDate(patient.lastVisit)}</span>
                          <span className="mt-1 block text-xs text-slate-400 sm:mt-0 sm:ml-2 sm:inline">
                            ({relativeLabel(days)})
                          </span>
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

                        <TableCell className="max-w-[min(28rem,26vw)] py-5 align-middle whitespace-nowrap">
                          <p className="truncate text-sm text-slate-500" title={patient.medicalHistorySummary}>
                            {patient.medicalHistorySummary}
                          </p>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] z-40 flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_14px_44px_-14px_rgba(5,150,105,0.65)] ring-2 ring-white/90 transition hover:bg-emerald-700 hover:shadow-xl active:scale-[0.98] md:bottom-10 md:right-10 md:size-[3.75rem]"
        aria-label="Add new patient"
      >
        <UserPlus className="size-7 shrink-0 stroke-[1.85] md:size-8" />
      </button>

      <AddPatientDialog open={addOpen} onOpenChange={setAddOpen} onSave={addPatient} />
    </>
  )
}
