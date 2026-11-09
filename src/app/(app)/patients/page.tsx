"use client"

import Link from "next/link"
import { ChevronRight, Search, UserPlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { PagePlate, PlateFact, PlateSpacer } from "@/components/layout/page-plate"
import { useLocale } from "@/components/providers/locale-provider"
import {
  useAddPatient,
  useMergedPatients,
  usePatientExtras,
} from "@/components/providers/patient-extras-provider"
import { Button } from "@/components/ui/button"
import { StateMark } from "@/components/ui/state-mark"
import { OwedTag } from "@/features/finances/components/pending-row"
import { PaymentClaimBadge } from "@/features/finances/components/payment-claim-badge"
import { usePaymentClaims } from "@/features/finances/lib/use-payment-claims"
import { Input } from "@/components/ui/input"
import { AddPatientDialog } from "@/features/patients/components/add-patient-dialog"
import { ExportButton, ExportDialog } from "@/features/exports/components/export-dialog"
import { patientColumns } from "@/features/exports/lib/build-exports"
import { loadExportSource } from "@/features/exports/lib/export-source"
import { datedFilename, downloadCsv } from "@/lib/file-export"
import { localeToBcp47 } from "@/lib/format-locale"
import { localizePatient } from "@/lib/i18n/localized-seed"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import type { PatientSummary } from "@/types/domain"
import { cn } from "@/lib/utils"

type FilterKey = "frozen" | "past" | "active" | "relevant"

/** Rows rendered at a time. Enough to fill a tall screen and scroll a little. */
const PAGE_SIZE = 60

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

/**
 * What the badge says about a patient, in the same words the filters use.
 *
 * `status` is a stored field and every one of the 1,178 imported patients
 * carries "active", so the column read "Active" for people last seen a year
 * ago — while the filter beside it defines Active as "has a future visit".
 * The column answered a different question from the one above it.
 *
 * Frozen and past are decisions somebody made and stay as they are. For an
 * active patient the badge now says which of the two things they are: booked
 * in, or merely still recent. A patient who is neither gets no badge, because
 * there is nothing true and short to say about them.
 *
 * These are statuses of a person, not states of a visit, so they are drawn as
 * words — never orange. The one that is about a visit, "booked in", carries
 * the ring the rest of the app uses for a booked visit.
 */
type StatusTone = "booked" | "frozen" | "quiet"

function statusBadge(
  status: PatientSummary["status"],
  hasFuture: boolean,
  isRelevant: boolean,
): { key: string; tone: StatusTone } | null {
  if (status === "frozen") return { key: "status.patient.frozen", tone: "frozen" }
  if (status === "past") return { key: "status.patient.past", tone: "quiet" }
  if (hasFuture) return { key: "status.patient.active", tone: "booked" }
  if (isRelevant) return { key: "patients.filter.relevant", tone: "quiet" }
  return null
}

function StatusText({
  badge,
  t,
}: {
  badge: ReturnType<typeof statusBadge>
  t: (key: string) => string
}) {
  if (!badge) return null
  if (badge.tone === "booked") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
        <StateMark state="plan" />
        {t(badge.key)}
      </span>
    )
  }
  if (badge.tone === "frozen") {
    return (
      <span className="inline-flex min-h-6 items-center rounded-[4px] bg-sunk px-2 text-sm font-medium text-ink">
        {t(badge.key)}
      </span>
    )
  }
  return <span className="text-sm text-mute">{t(badge.key)}</span>
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
  const { locale, t, formatBalanceDisplay, formatMoney } = useLocale()
  const { appointments } = useScheduleDay()
  const paymentClaims = usePaymentClaims()
  const merged = useMergedPatients()
  // An empty list while the first read is still running is "loading", not
  // "nobody matches" — the two read very differently to someone at reception.
  const { loading: patientsLoading } = usePatientExtras()
  const listPending = patientsLoading && merged.length === 0
  const addPatient = useAddPatient()
  const [query, setQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  /**
   * How many rows are in the DOM.
   *
   * The page rendered every patient, and rendered them twice — a card list for
   * narrow screens and a table for wide ones, both mounted, one hidden by CSS.
   * At 1,178 patients that is over two thousand row components built before
   * anything appears, which is why opening this page from the dashboard looked
   * like the app had stopped rather than like it was working.
   *
   * A window plus a button is the whole fix and needs no new dependency. Search
   * and the filters narrow the list first, which is how anybody actually finds
   * a patient in a list this long.
   */
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const localizedPatients = useMemo(
    () => merged.map((p) => localizePatient(p, locale)),
    [merged, locale],
  )

  /**
   * One formatter, not one per row. `toLocaleDateString` builds a fresh
   * Intl.DateTimeFormat on every call, and this runs once per patient in each
   * of the two lists — the most expensive thing on the page after the rows
   * themselves.
   */
  const visitDateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(localeToBcp47(locale), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  )

  /** An em dash where there is no visit on record — never "Invalid Date". */
  const formatVisitDate = (iso: string) => {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return visitDateFmt.format(d)
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

  /**
   * Who has something in the diary ahead of them, from the clinic's real
   * appointments. This was a fixed set built from the demo week, so the
   * "Active (future visit)" filter could not match a real patient at all.
   */
  const patientsWithFutureVisit = useMemo(() => {
    const now = Date.now()
    return new Set(
      appointments
        .filter(
          (a) =>
            a.status !== "cancelled" &&
            new Date(`${a.date}T${a.end || a.start || "00:00"}`).getTime() >= now,
        )
        .map((a) => a.patientId),
    )
  }, [appointments])

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
  }, [query, activeFilters, localizedPatients, patientsWithFutureVisit])

  /** A new search is a new list; showing row 900 of the last one would be odd. */
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, activeFilters])

  const shown = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount])
  const remaining = rows.length - shown.length

  const toggleFilter = (id: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const countFmt = useMemo(() => new Intl.NumberFormat(localeToBcp47(locale)), [locale])

  /**
   * One list for every width. The row is a link to the chart — the whole row,
   * so the target is the row and not the few pixels of a name — and its
   * columns fold into the line under the name as the screen narrows.
   */
  const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_8rem_7.5rem_7.5rem_1rem] lg:grid-cols-[minmax(0,1fr)_9rem_10rem_9rem_9rem_1rem] lg:gap-x-5"

  return (
    <div className="space-y-6">
      <PagePlate>
        <PlateFact display label={t("patients.page.title")}>
          {listPending ? "—" : countFmt.format(merged.length)}
        </PlateFact>
        <PlateSpacer />
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-14 gap-2 px-6 text-[17px]"
        >
          <UserPlus className="size-5" aria-hidden />
          {t("patients.addPatient")}
        </Button>
      </PagePlate>

      <h1 className="sr-only">{t("patients.page.title")}</h1>

      <section className="min-w-0 rounded-md border border-hair bg-paper">
        <div className="flex flex-col gap-3 border-b border-hair px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
          <div className="relative w-full min-w-0 lg:max-w-md">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("patients.search.placeholder")}
              className="ps-10"
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
                    "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
                    on
                      ? "border-cobalt bg-cobalt font-bold text-white"
                      : "border-hair bg-paper text-ink hover:bg-ground",
                  )}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Column names, from tablet width up — below that each row says it in words. */}
        <div
          className={cn(
            ROW_GRID,
            "hidden min-h-11 border-b border-hair-soft text-sm font-medium text-mute md:grid",
          )}
          aria-hidden
        >
          <span>{t("patients.col.name")}</span>
          <span className="hidden lg:block">{t("addPatient.label.phone")}</span>
          <span>{t("patients.col.lastVisit")}</span>
          <span>{t("patients.col.status")}</span>
          <span className="text-end">{t("patients.col.balance")}</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[17px] text-mute">
            {t(listPending ? "patients.loading" : "patients.empty.filters")}
          </p>
        ) : (
          <ul>
            {shown.map(({ patient, days, balance, hasFuture, isRelevant }) => {
              const badge = statusBadge(patient.status, hasFuture, isRelevant)
              const isSettled = balance === 0
              const claimed = paymentClaims.patients.has(patient.id)
              const relative = relativeVisitLabel(days, t)
              return (
                <li key={patient.id} className="border-b border-hair-soft last:border-b-0">
                  <Link
                    href={`/patients/${patient.id}`}
                    className={cn(
                      ROW_GRID,
                      "min-h-[72px] py-3 text-ink transition-colors outline-none hover:bg-ground focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-cobalt",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[17px] font-bold">{patient.fullName}</span>
                      {/* Below tablet width the columns live here, as one line. */}
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute md:hidden">
                        {patient.phone && (
                          <span dir="ltr" className="tabular-nums">
                            {patient.phone}
                          </span>
                        )}
                        <span className="tabular-nums">{formatVisitDate(patient.lastVisit)}</span>
                        <StatusText badge={badge} t={t} />
                      </span>
                      {/* On a tablet held upright the phone takes the line under
                          the name; with room for its own column, the note does. */}
                      {patient.phone && (
                        <span className="mt-0.5 hidden text-sm tabular-nums text-mute md:block lg:hidden">
                          <bdi dir="ltr">{patient.phone}</bdi>
                        </span>
                      )}
                      <span className="mt-0.5 hidden truncate text-sm text-mute lg:block" title={patient.medicalHistorySummary}>
                        {patient.medicalHistorySummary}
                      </span>
                    </span>

                    <span className="hidden text-sm tabular-nums lg:block">
                      {patient.phone ? <span dir="ltr">{patient.phone}</span> : <span className="text-faint">—</span>}
                    </span>

                    <span className="hidden min-w-0 flex-col md:flex">
                      <span className="text-sm tabular-nums">{formatVisitDate(patient.lastVisit)}</span>
                      {relative && <span className="text-sm text-mute">{relative}</span>}
                    </span>

                    <span className="hidden md:block">
                      <StatusText badge={badge} t={t} />
                    </span>

                    <span className="flex justify-end">
                      {isSettled ? (
                        <span className="text-sm text-mute">{t("finances.badge.settled")}</span>
                      ) : claimed ? (
                        // Outranks the debt: this person is not to be chased.
                        <PaymentClaimBadge amount={formatBalanceDisplay(patient.balance)} />
                      ) : (
                        <OwedTag className="min-h-7 text-sm">
                          {t("patients.debtBadge", { amount: formatBalanceDisplay(patient.balance) })}
                        </OwedTag>
                      )}
                    </span>

                    <ChevronRight className="hidden size-4 text-faint md:block rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* Stated, never silent. A list that stops at sixty without saying so
            is a list that has lost people. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-hair px-4 py-3 sm:px-6">
          {remaining > 0 && (
            <>
              <p className="text-sm tabular-nums text-mute">
                {t("patients.showing", { shown: shown.length, total: rows.length })}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-3 text-sm"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                {t("patients.showMore", { n: Math.min(PAGE_SIZE, remaining) })}
              </Button>
            </>
          )}
          <ExportButton
            onClick={() => setExportOpen(true)}
            label={t("export.patients")}
            className="ms-auto h-11 border-hair px-3 text-sm text-ink [&_svg]:text-ink"
          />
        </div>
      </section>

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
        onExportCsv={async (options) => {
          const source = await loadExportSource(formatMoney)
          downloadCsv(
            patientColumns(options, source),
            rows.map((r) => r.patient),
            datedFilename("patients", "csv"),
          )
          setExportOpen(false)
        }}
      />
    </div>
  )
}
