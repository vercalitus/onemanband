"use client"

import Link from "next/link"
import { Activity, Search, UserPlus } from "lucide-react"
import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useAddPatient, useMergedPatients } from "@/components/providers/patient-extras-provider"
import { Badge } from "@/components/ui/badge"
import { PaymentClaimBadge } from "@/features/finances/components/payment-claim-badge"
import { usePaymentClaims } from "@/features/finances/lib/use-payment-claims"
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
import { AddPatientDialog } from "@/features/patients/components/add-patient-dialog"
import { ExportButton, ExportDialog } from "@/features/exports/components/export-dialog"
import { patientColumns } from "@/features/exports/lib/build-exports"
import { datedFilename, downloadCsv } from "@/lib/file-export"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { localeToBcp47 } from "@/lib/format-locale"
import { localizePatient } from "@/lib/i18n/localized-seed"
import { todaySchedule, weeklySchedule } from "@/lib/mock-data"
import type { PatientSummary } from "@/types/domain"
import { cn } from "@/lib/utils"

type FilterKey = "frozen" | "past" | "active" | "relevant"

const patientsWithFutureVisit = new Set<string>([
  ...todaySchedule.map((a) => a.patientId),
  ...weeklySchedule.map((a) => a.patientId),
])

const TODAY = new Date()

/**
 * Days since a visit, or null when there is no date to count from.
 *
 * An imported patient may have no visit on record at all, and arithmetic on an
 * absent date produced "Invalid Date (NaN years ago)" on screen — which reads
 * like a broken record rather than a missing one.
 */
function daysSince(iso: string): number | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const ms = TODAY.getTime() - then.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function parseBalance(value: string): number {
  const digits = value.replace(/[^0-9.-]/g, "")
  const n = Number.parseFloat(digits)
  return Number.isFinite(n) ? n : 0
}

function statusBadgeClasses(status: PatientSummary["status"]) {
  return cn(
    "border-slate-200 bg-slate-50 text-slate-600",
    status === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
    status === "frozen" && "border-sky-200 bg-sky-50 text-sky-700",
    status === "past" && "border-slate-200 bg-slate-50 text-slate-500",
  )
}

function relativeVisitLabel(
  days: number | null,
  tr: (key: string, params?: Record<string, string | number | undefined>) => string,
) {
  // No visit on record. Say nothing rather than guess how long ago it was.
  if (days === null) return null
  if (days <= 0) return tr("patients.relative.today")
  if (days === 1) return tr("patients.relative.oneDayAgo")
  if (days < 30) return tr("patients.relative.daysAgo", { n: days })
  const months = Math.floor(days / 30)
  if (months < 12)
    return months === 1 ? tr("patients.relative.oneMonthAgo") : tr("patients.relative.monthsAgo", { n: months })
  const years = Math.floor(days / 365)
  return years === 1 ? tr("patients.relative.oneYearAgo") : tr("patients.relative.yearsAgo", { n: years })
}

export default function PatientsPage() {
  const { locale, t, formatBalanceDisplay } = useLocale()
  const paymentClaims = usePaymentClaims()
  const merged = useMergedPatients()
  const addPatient = useAddPatient()
  const [query, setQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const localizedPatients = useMemo(
    () => merged.map((p) => localizePatient(p, locale)),
    [merged, locale],
  )

  /** An em dash where there is no visit on record — never "Invalid Date". */
  const formatVisitDate = (iso: string) => {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString(localeToBcp47(locale), {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const filterButtons = useMemo(
    () => [
      { id: "active" as const, label: t("patients.filter.active") },
      { id: "relevant" as const, label: t("patients.filter.relevant") },
      { id: "frozen" as const, label: t("patients.filter.frozen") },
      { id: "past" as const, label: t("patients.filter.past") },
    ],
    [t],
  )

  const rows = useMemo(() => {
    const decorated = localizedPatients.map((p) => {
      const days = daysSince(p.lastVisit)
      const balance = parseBalance(p.balance)
      const hasFuture = patientsWithFutureVisit.has(p.id)
      return {
        patient: p,
        days,
        balance,
        hasFuture,
        // Unknown is not recent. A patient with no visit on record does not
        // belong in "still relevant" just because there is nothing to measure.
        isRelevant: days !== null && days <= 365,
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
        // Patients with no visit on record sort last, not first.
        const dayA = a.days ?? Number.POSITIVE_INFINITY
        const dayB = b.days ?? Number.POSITIVE_INFINITY
        return dayB < dayA ? 1 : -1
      })
  }, [query, activeFilters, localizedPatients])

  const toggleFilter = (id: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function PatientMobileCardInline({
    patient,
    days,
    balance,
  }: {
    patient: PatientSummary
    days: number | null
    balance: number
  }) {
    const isSettled = balance === 0
    const claimed = paymentClaims.patients.has(patient.id)
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
            {t(`status.patient.${patient.status}`)}
          </Badge>
        </div>
        <p className="mt-3 font-mono text-xs tabular-nums text-slate-700">
          {formatVisitDate(patient.lastVisit)}{" "}
          {relativeVisitLabel(days, t) && (
            <span className="font-sans text-slate-400">({relativeVisitLabel(days, t)})</span>
          )}
        </p>
        <div className="mt-2">
          {isSettled ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              {t("finances.badge.settled")}
            </Badge>
          ) : claimed ? (
            // Outranks the debt badge: this person is not to be chased.
            <PaymentClaimBadge amount={formatBalanceDisplay(patient.balance)} />
          ) : (
            <Badge className="border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100">
              {t("patients.debtBadge", { amount: formatBalanceDisplay(patient.balance) })}
            </Badge>
          )}
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">{patient.medicalHistorySummary}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className={elevatedCardClass}>
        <CardHeader
          className={cn(darkCardHeaderClass, "flex flex-row flex-wrap items-center justify-between gap-3 py-3")}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Activity className="size-5 shrink-0 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-lg font-bold tracking-tight text-white sm:text-xl">{t("patients.page.title")}</CardTitle>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white ring-1 ring-white/20">
            {merged.length}&nbsp;
            <span className="font-medium">
              {merged.length === 1 ? t("patients.count.one") : t("patients.count.many")}
            </span>
          </span>
        </CardHeader>

        <CardContent className={`${elevatedCardBodyClass} space-y-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="relative w-full min-w-0 lg:max-w-md">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-sky-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("patients.search.placeholder")}
                className="ps-9"
                aria-label={t("patients.search.placeholder")}
              />
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {filterButtons.map((f) => {
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
                {t("patients.empty.filters")}
              </p>
            ) : (
              rows.map(({ patient, days, balance }) => (
                <PatientMobileCardInline key={patient.id} patient={patient} days={days} balance={balance} />
              ))
            )}
          </div>

          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 hover:bg-transparent">
                  <TableHead className="min-w-[9rem]">{t("patients.col.name")}</TableHead>
                  <TableHead className="min-w-[6rem]">{t("patients.col.status")}</TableHead>
                  <TableHead className="min-w-[11rem]">{t("patients.col.lastVisit")}</TableHead>
                  <TableHead className="min-w-[7rem]">{t("patients.col.balance")}</TableHead>
                  <TableHead className="min-w-[14rem] max-w-[min(28rem,28vw)]">{t("patients.col.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">
                      {t("patients.empty.filters")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ patient, days, balance }) => {
                    const isSettled = balance === 0
                    const claimed = paymentClaims.patients.has(patient.id)
                    return (
                      <TableRow
                        key={patient.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                      >
                        <TableCell className="py-5 align-middle">
                          <Link
                            href={`/patients/${patient.id}`}
                            className="block rounded-md text-start text-[15px] font-medium tracking-tight text-slate-900 transition-colors hover:text-sky-700"
                          >
                            {patient.fullName}
                          </Link>
                        </TableCell>

                        <TableCell className="py-5 align-middle">
                          <Badge variant="outline" className={statusBadgeClasses(patient.status)}>
                            {t(`status.patient.${patient.status}`)}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-5 align-middle">
                          <span className="font-mono text-sm tabular-nums text-slate-800">{formatVisitDate(patient.lastVisit)}</span>
                          {relativeVisitLabel(days, t) && (
                            <span className="mt-1 block text-xs text-slate-400 sm:mt-0 sm:ms-2 sm:inline">
                              ({relativeVisitLabel(days, t)})
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-5 align-middle">
                          {isSettled ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                              {t("finances.badge.settled")}
                            </Badge>
                          ) : claimed ? (
                            <PaymentClaimBadge amount={formatBalanceDisplay(patient.balance)} />
                          ) : (
                            <Badge className="border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                              {t("patients.debtBadge", { amount: formatBalanceDisplay(patient.balance) })}
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

          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-5 pb-1">
            <ExportButton onClick={() => setExportOpen(true)} label={t("export.patients")} />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-0 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
              aria-label={t("patients.addPatient")}
            >
              <span>{t("patients.addPatient")}</span>
              <UserPlus className="size-4 shrink-0 stroke-[2] text-sky-600" aria-hidden />
            </button>
          </div>
        </CardContent>
      </Card>

      <AddPatientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(patient) => void addPatient(patient)}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title={t("export.patients")}
        subtitle={t("export.patientsSubtitle", { count: rows.length })}
        onExportCsv={(options) => {
          downloadCsv(
            patientColumns(options),
            rows.map((r) => r.patient),
            datedFilename("patients", "csv"),
          )
          setExportOpen(false)
        }}
      />
    </div>
  )
}
