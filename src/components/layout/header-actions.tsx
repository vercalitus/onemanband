"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Bell,
  BellOff,
  CalendarPlus,
  CircleCheck,
  ClipboardList,
  Link2,
  MessageCircle,
  Phone,
  Plus,
  Receipt,
  Search,
  UserPlus,
  UserRound,
} from "lucide-react"
import Link from "next/link"

import { useLocale } from "@/components/providers/locale-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAddTask } from "@/components/providers/add-task-provider"
import { useGlobalAddPatient } from "@/components/providers/global-add-patient-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { issueInvoiceForVisit } from "@/features/automations/lib/billing-bridge"
import { onInvoiceIssued, planContextFromSettings } from "@/features/automations/lib/events"
import { mintToken, tokenLink } from "@/features/automations/lib/tokens"
import { readField, readOptOut, writeOptOut } from "@/features/patients/lib/patient-extras-store"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { localizePatient } from "@/lib/i18n/localized-seed"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { financesByPatient } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { AppointmentType, ScheduleItem } from "@/types/domain"

/** Today's date as YYYY-MM-DD, matching how mock appointments store `date`. */
const todayISO = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
})()

/**
 * A session is completable when there's a visit today that isn't done or
 * cancelled. Reads the shared schedule — the demo day while the clinic has no
 * diary of its own, the real one the moment it does.
 */
function hasSessionToComplete(patientId: string, appointments: ScheduleItem[]): boolean {
  return appointments.some(
    (a) =>
      a.patientId === patientId &&
      a.date === todayISO &&
      (a.status === "scheduled" || a.status === "confirmed" || a.status === "uncertain"),
  )
}

/** An invoice is worth surfacing when something is unsent or still owed. */
function hasInvoiceAwaiting(patientId: string): boolean {
  const recs = financesByPatient[patientId] ?? []
  return recs.some(
    (r) =>
      r.invoiceStatus === "draft" ||
      r.invoiceStatus === "overdue" ||
      r.paymentStatus === "pending" ||
      r.paymentStatus === "partially_paid" ||
      r.paymentStatus === "failed",
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

/** Header patient search (two-step: find → act) plus the quick-add menu. */
export function HeaderActions() {
  const { t, locale } = useLocale()
  const { openAddTask } = useAddTask()
  const { openGlobalAddPatient } = useGlobalAddPatient()
  const { openCreateAppointment } = useScheduleDay()
  const [modal, setModal] = useState<null | "search" | "add">(null)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /**
   * Search the clinic's own patients.
   *
   * This dialog kept its own copy of the mock list, so it went on offering six
   * invented people after the real ones were imported — the most misleading
   * place for that to happen, since search is where someone goes when they are
   * looking for a specific person and will believe the answer.
   *
   * Localisation only applies to the demo seed, whose names are translated per
   * locale. Real patients are stored under the name they gave.
   */
  const mergedPatients = useMergedPatients()
  const localizedPatients = useMemo(
    () => mergedPatients.map((p) => localizePatient(p, locale)),
    [mergedPatients, locale],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === "") return localizedPatients.slice(0, 6)
    const digits = q.replace(/\D/g, "")
    return localizedPatients.filter((p) => {
      if (p.fullName.toLowerCase().includes(q)) return true
      return digits.length > 0 && p.phone.replace(/\D/g, "").includes(digits)
    })
  }, [query, localizedPatients])

  const selected = selectedId
    ? localizedPatients.find((p) => p.id === selectedId) ?? null
    : null

  const closeModal = () => {
    setModal(null)
    setQuery("")
    setSelectedId(null)
  }

  return (
    <>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setModal("search")}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50 hover:text-sky-900 sm:gap-2 sm:px-4 md:px-5"
          aria-label={t("header.search")}
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden sm:inline">{t("header.search")}</span>
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setModal("add")}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-medium text-sky-700 outline-none transition-colors hover:bg-sky-50 hover:text-sky-900 sm:gap-2 sm:px-4 md:px-5"
          aria-label={t("header.add")}
          aria-haspopup="dialog"
          aria-expanded={modal === "add"}
        >
          <Plus className="size-4 shrink-0" />
          <span className="hidden sm:inline">{t("header.add")}</span>
        </button>
      </div>

      <Dialog
        modal={false}
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <DialogContent
          showCloseButton
          className={
            modal === "search"
              ? "gap-0 overflow-hidden rounded-3xl border-slate-100 p-0 shadow-2xl sm:max-w-xl"
              : "max-w-md gap-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-md"
          }
        >
          <DialogTitle className="sr-only">
            {modal === "search" ? t("header.search.title") : modal === "add" ? t("header.add.title") : ""}
          </DialogTitle>

          {modal === "search" && !selected && (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <Search className="size-4 shrink-0 text-sky-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("header.dialog.searchPlaceholder")}
                  dir="auto"
                  className="min-w-0 flex-1 bg-transparent text-start text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <span className="hidden shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600 sm:block">
                  {t("header.search.scope")}
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <p className="px-5 py-4 text-start text-sm text-slate-400">{t("header.dialog.noResults")}</p>
                ) : (
                  results.map((p) => (
                    <ResultRow
                      key={p.id}
                      patient={p}
                      onSelect={() => setSelectedId(p.id)}
                      onSchedule={() => {
                        openCreateAppointment(undefined, { id: p.id, name: p.fullName })
                        closeModal()
                      }}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {modal === "search" && selected && (
            <PatientActionSheet
              patient={selected}
              onBack={() => setSelectedId(null)}
              onNavigate={closeModal}
              onSchedule={() => {
                openCreateAppointment(undefined, { id: selected.id, name: selected.fullName })
                closeModal()
              }}
            />
          )}

          {modal === "add" && (
            <div className="flex flex-col gap-2 p-4 pt-5">
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openGlobalAddPatient()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <UserPlus className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-base font-semibold text-slate-900">{t("header.add.patient.title")}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t("header.add.patient.sub")}</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openCreateAppointment()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <CalendarPlus className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-base font-semibold text-slate-900">{t("header.add.appointment.title")}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t("header.add.appointment.sub")}</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openAddTask()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <ClipboardList className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-base font-semibold text-slate-900">{t("header.add.task.title")}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t("header.add.task.sub")}</span>
                </span>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Phone reduced to digits for a wa.me link; empty when there's nothing dialable. */
const whatsappDigits = (phone: string) => phone.replace(/[^\d]/g, "")

const ROW_ACTION =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-sky-700 hover:shadow-sm"

/**
 * One search result.
 *
 * The three actions sit on the row itself rather than behind a tap, because
 * they are the overwhelming majority of what the search is used for and none
 * of them needs anything from the patient's chart. Everything heavier lives in
 * the action sheet, reached by tapping the row.
 *
 * The actions are real buttons layered over a button-shaped row, so the row is
 * a <div> with its own click target — nesting them would be invalid HTML and
 * would swallow the inner clicks.
 */
function ResultRow({
  patient,
  onSelect,
  onSchedule,
}: {
  patient: ReturnType<typeof localizePatient>
  onSelect: () => void
  onSchedule: () => void
}) {
  const { t } = useLocale()
  const { appointments } = useScheduleDay()
  const pending =
    hasSessionToComplete(patient.id, appointments) || hasInvoiceAwaiting(patient.id)
  const waDigits = whatsappDigits(patient.phone)

  return (
    <div className="group/row flex w-full items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-slate-50">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700">
          {initials(patient.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-800">{patient.fullName}</span>
          <span className="block truncate text-xs text-slate-400">
            {/* Phone is here because it is also what you search by. */}
            <span dir="ltr" className="font-mono">
              {patient.phone}
            </span>
            {" · "}
            {t("patients.col.lastVisit")} {patient.lastVisit}
          </span>
        </span>
        {pending && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-amber-400"
            aria-label={t("header.search.pendingAria")}
          />
        )}
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            patient.status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : patient.status === "frozen"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500",
          )}
        >
          {t(`status.patient.${patient.status}`)}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {waDigits ? (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(ROW_ACTION, "hover:text-emerald-700")}
            aria-label={`${t("header.search.whatsapp")}: ${patient.fullName}`}
            title={t("header.search.whatsapp")}
          >
            <MessageCircle className="size-4" aria-hidden />
          </a>
        ) : null}
        {patient.phone ? (
          <a
            href={`tel:${patient.phone.replace(/[^\d+]/g, "")}`}
            className={cn(ROW_ACTION, "hover:text-emerald-700")}
            aria-label={`${t("header.search.call")}: ${patient.fullName}`}
            title={t("header.search.call")}
          >
            <Phone className="size-4" aria-hidden />
          </a>
        ) : null}
        <button
          type="button"
          onClick={onSchedule}
          className={ROW_ACTION}
          aria-label={`${t("header.search.schedule")}: ${patient.fullName}`}
          title={t("header.search.schedule")}
        >
          <CalendarPlus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

interface ActionSheetProps {
  patient: ReturnType<typeof localizePatient>
  onBack: () => void
  onNavigate: () => void
  onSchedule: () => void
}

const ACTION_TILE =
  "flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-start text-sm font-semibold text-slate-800 transition-colors hover:border-sky-200 hover:bg-sky-50/60"

/**
 * Step 2 — the fuller set of actions for a chosen patient.
 *
 * These act in place wherever acting in place is honest. "Complete session" is
 * the deliberate exception: it needs notes, the drawing canvas and possibly a
 * voice memo, so it still opens the chart rather than pretending a popover can
 * finish a treatment record.
 */
function PatientActionSheet({ patient, onBack, onNavigate, onSchedule }: ActionSheetProps) {
  const { t, localeTag } = useLocale()
  const { appointments } = useScheduleDay()
  const canComplete = hasSessionToComplete(patient.id, appointments)
  const canInvoice = hasInvoiceAwaiting(patient.id)
  const waDigits = whatsappDigits(patient.phone)

  // Short-lived confirmations so an action that changes data says so; the sheet
  // stays open, which is the point of acting from here.
  const [done, setDone] = useState<string | null>(null)
  const [muted, setMuted] = useState(() => readOptOut(patient.id).all)

  const sendBookingLink = async () => {
    const token = mintToken("book", { patientId: patient.id })
    const link = tokenLink(token)
    try {
      await navigator.clipboard.writeText(link)
      setDone(t("header.search.linkCopied"))
    } catch {
      // Clipboard can be blocked; the link still exists and WhatsApp can carry it.
      setDone(link)
    }
  }

  const toggleMute = () => {
    const next = !muted
    writeOptOut(patient.id, { ...readOptOut(patient.id), all: next })
    setMuted(next)
    setDone(t(next ? "header.search.muted" : "header.search.unmuted"))
  }

  const issueInvoice = () => {
    const settings = readClinicSettings()
    const type = readField<AppointmentType>(patient.id, "lastAppointmentType", "adjustments")
    const price = settings.treatmentTypes.find((r) => r.type === type)?.priceIls
    if (price === undefined) return

    const visitDate = new Date().toISOString().slice(0, 10)
    const { invoice, created } = issueInvoiceForVisit({
      patientId: patient.id,
      patientName: patient.fullName,
      // No appointment behind a manually issued invoice, so key it by day —
      // enough to stop a double tap billing twice.
      appointmentId: `manual-${patient.id}-${visitDate}`,
      treatmentType: type,
      amount: price,
      visitDate,
      provider: settings.integrations.billingProvider,
    })

    if (created) {
      onInvoiceIssued(
        {
          patientId: patient.id,
          patientName: patient.fullName,
          phone: patient.phone,
          email: patient.email,
          invoiceId: invoice.id,
          invoiceAmount: invoice.displayAmount,
          invoiceIssuedDate: visitDate,
        },
        planContextFromSettings(readClinicSettings(), {
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
          locale: localeTag,
        }),
      )
    }
    setDone(
      t(created ? "header.search.invoiceIssued" : "header.search.invoiceExists", {
        amount: invoice.displayAmount,
      }),
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          aria-label={t("header.search.back")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("header.search.back")}
        </button>
        <span className="ms-auto flex items-center gap-2.5">
          <span className="text-end">
            <span className="block text-sm font-semibold text-slate-800">{patient.fullName}</span>
            <span className="block text-xs text-slate-400">{t(`status.patient.${patient.status}`)}</span>
          </span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700">
            {initials(patient.fullName)}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <Link href={`/patients/${patient.id}`} onClick={onNavigate} className={ACTION_TILE}>
          <UserRound className="size-4.5 text-sky-600" aria-hidden />
          {t("header.search.openChart")}
        </Link>

        <button type="button" onClick={onSchedule} className={ACTION_TILE}>
          <CalendarPlus className="size-4.5 text-sky-600" aria-hidden />
          {t("header.search.schedule")}
        </button>

        {canComplete && (
          <Link
            href={`/patients/${patient.id}#active-session`}
            onClick={onNavigate}
            className={ACTION_TILE}
          >
            <CircleCheck className="size-4.5 text-sky-600" aria-hidden />
            {t("header.search.complete")}
          </Link>
        )}

        <button type="button" onClick={issueInvoice} className={ACTION_TILE}>
          <Receipt className="size-4.5 text-sky-600" aria-hidden />
          {t(canInvoice ? "header.search.invoice" : "header.search.invoiceNew")}
        </button>

        <button type="button" onClick={sendBookingLink} className={ACTION_TILE}>
          <Link2 className="size-4.5 text-sky-600" aria-hidden />
          {t("header.search.bookingLink")}
        </button>

        <button
          type="button"
          onClick={toggleMute}
          className={cn(ACTION_TILE, muted && "border-amber-200 bg-amber-50/60")}
        >
          {muted ? (
            <BellOff className="size-4.5 text-amber-600" aria-hidden />
          ) : (
            <Bell className="size-4.5 text-sky-600" aria-hidden />
          )}
          {t(muted ? "header.search.unmute" : "header.search.mute")}
        </button>

        {patient.phone && (
          <a href={`tel:${patient.phone.replace(/[^\d+]/g, "")}`} className={cn(ACTION_TILE, "col-span-2")}>
            <Phone className="size-4.5 text-emerald-600" aria-hidden />
            {t("header.search.call")}
            <span className="ms-auto font-mono text-xs font-normal text-slate-400" dir="ltr">
              {patient.phone}
            </span>
          </a>
        )}

        {waDigits && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(ACTION_TILE, "col-span-2")}
          >
            <MessageCircle className="size-4.5 text-emerald-600" aria-hidden />
            {t("header.search.whatsapp")}
          </a>
        )}
      </div>

      {done ? (
        <p
          className="mx-4 mb-4 -mt-1 break-all rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          role="status"
        >
          {done}
        </p>
      ) : null}
    </div>
  )
}
