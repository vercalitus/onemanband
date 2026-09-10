"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, Check, ChevronDown, ChevronUp, Mail, MapPin, Pencil, Phone, X } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { PaymentClaimBadge } from "@/features/finances/components/payment-claim-badge"
import { usePaymentClaims } from "@/features/finances/lib/use-payment-claims"
import { cn } from "@/lib/utils"
import type { BodyMark3d, PatientSummary } from "@/types/domain"
import type { ClinicalStatus, PatientContactOverrides } from "../lib/use-patient-cockpit"
/**
 * three.js is ~170 KB and the chart is opened many times a day for things that
 * are not the body map. It arrives when the panel is opened, not before.
 */
const SkeletonViewer = dynamic(
  () => import("@/features/body-map-3d/components/skeleton-viewer").then((m) => m.SkeletonViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] rounded-2xl border border-slate-200 bg-slate-50" aria-hidden />
    ),
  },
)

const STATUS_BADGE: Record<PatientSummary["status"], string> = {
  active: "bg-slate-100 text-slate-700 border-slate-200",
  frozen: "bg-slate-100 text-slate-600 border-slate-200",
  past: "bg-slate-100 text-slate-500 border-slate-200",
}

interface Props {
  patient: PatientSummary
  overrides: PatientContactOverrides
  totalSessionsDone: number
  planTarget: number
  /** False when the target is the practice default rather than this patient's plan. */
  planIsPersonal: boolean
  onPlanTargetChange: (sessions: number | null) => void
  clinicalStatus: ClinicalStatus
  onClinicalStatusChange: (v: string) => void
  /** Absent on the demo chart, where the badge is only a badge. */
  onStatusChange?: (status: PatientSummary["status"]) => void
  onSaveOverrides: (o: PatientContactOverrides) => void
  bodyMarks3d: BodyMark3d[]
  onAddBodyMark3d: (mark: Omit<BodyMark3d, "id" | "createdAt">) => void
  onUpdateBodyMark3dNote: (id: string, note: string) => void
  onRemoveBodyMark3d: (id: string) => void
}

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition-[border-color] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"

export function PatientSmartHeader({
  patient,
  overrides,
  totalSessionsDone,
  planTarget,
  planIsPersonal,
  onPlanTargetChange,
  clinicalStatus,
  onClinicalStatusChange,
  onStatusChange,
  onSaveOverrides,
  bodyMarks3d,
  onAddBodyMark3d,
  onUpdateBodyMark3dNote,
  onRemoveBodyMark3d,
}: Props) {
  const { t, localeTag } = useLocale()
  const paymentClaimed = usePaymentClaims().patients.has(patient.id)
  const [mapOpen, setMapOpen] = useState(false)
  const clampedDone = Math.min(totalSessionsDone, planTarget)
  const pct = planTarget > 0 ? Math.round((clampedDone / planTarget) * 100) : 0

  /** Merged display values — overrides win */
  const display = {
    phone: overrides.phone ?? patient.phone,
    email: overrides.email ?? patient.email,
    address: overrides.address ?? patient.address ?? "",
    medicalHistorySummary:
      overrides.medicalHistorySummary ?? patient.medicalHistorySummary,
  }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)

  const enterEdit = () => {
    setDraft(display)
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = () => {
    onSaveOverrides(draft)
    setEditing(false)
  }

  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState(clinicalStatus.manualText)

  /**
   * An empty box clears the status rather than restoring what was there. The
   * field is a claim about a patient, so a practitioner who deletes it means it
   * — and with nothing written the chart falls back to the last visit, which is
   * a truthful line rather than an old one kept alive by the editor.
   */
  const commitStatus = () => {
    onClinicalStatusChange(statusDraft.trim())
    setEditingStatus(false)
  }

  const openStatusEditor = () => {
    setStatusDraft(clinicalStatus.manualText)
    setEditingStatus(true)
  }

  const [editingPlan, setEditingPlan] = useState(false)
  const [planDraft, setPlanDraft] = useState(String(planTarget))

  const commitPlan = () => {
    const parsed = Number.parseInt(planDraft, 10)
    // An empty or impossible number clears the plan rather than inventing one,
    // and the chart falls back to the practice default.
    onPlanTargetChange(Number.isFinite(parsed) && parsed >= 1 && parsed <= 200 ? parsed : null)
    setEditingPlan(false)
  }

  const statusDate = clinicalStatus.at
    ? new Date(clinicalStatus.at).toLocaleDateString(localeTag, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
      {/* Breadcrumb */}
      <div className="border-b border-slate-100 px-6 py-3">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="size-3 rtl:rotate-180" aria-hidden />
          {t("patientChart.breadcrumb")}
        </Link>
      </div>

      {/* Main area */}
      <div className="px-6 py-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          {/* Name + status + summary */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 md:text-3xl">
                {patient.fullName}
              </h1>
              {onStatusChange ? (
                /* The badge is the control. A separate "edit status" affordance
                   would be one more thing on a crowded header for a change made
                   a few times a year. */
                <select
                  value={patient.status}
                  onChange={(e) => onStatusChange(e.target.value as PatientSummary["status"])}
                  aria-label={t("patientChart.statusChangeAria")}
                  className={cn(
                    "cursor-pointer appearance-none rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-sky-100",
                    STATUS_BADGE[patient.status],
                  )}
                >
                  {(["active", "frozen", "past"] as const).map((status) => (
                    <option key={status} value={status}>
                      {t(`status.patient.${status}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize",
                    STATUS_BADGE[patient.status],
                  )}
                >
                  {t(`status.patient.${patient.status}`)}
                </span>
              )}
              {/* Only ever shown for an open claim — an unpaid or settled
                  account says so on the Billing page, but "says they paid"
                  needs answering, so it follows the patient around. */}
              {paymentClaimed && <PaymentClaimBadge />}
            </div>

            {editing ? (
              <textarea
                value={draft.medicalHistorySummary}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, medicalHistorySummary: e.target.value }))
                }
                rows={3}
                className={cn(FIELD_CLASS, "resize-none")}
                placeholder={t("patientChart.medicalSummaryPh")}
              />
            ) : (
              <p className="max-w-xl text-sm leading-relaxed text-slate-500">
                {display.medicalHistorySummary}
              </p>
            )}
          </div>

          {/* Contact card */}
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("patientChart.contact")}
              </p>
              {!editing ? (
                <button
                  type="button"
                  onClick={enterEdit}
                  className="ms-1 flex items-center gap-1 rounded-md border border-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-sky-200 hover:text-sky-600"
                  aria-label={t("patientChart.editContactAria")}
                >
                  <Pencil className="size-2.5" aria-hidden />
                  {t("common.edit")}
                </button>
              ) : (
                <div className="ms-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    <Check className="size-2.5" aria-hidden />
                    {t("common.save")}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <X className="size-2.5" aria-hidden />
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="w-full space-y-1.5 lg:min-w-[240px]">
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  className={FIELD_CLASS}
                  placeholder={t("patientChart.phonePh")}
                />
                <input
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  className={FIELD_CLASS}
                  placeholder={t("patientChart.emailPh")}
                />
                <input
                  value={draft.address}
                  onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                  className={FIELD_CLASS}
                  placeholder={t("patientChart.addressPh")}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                  {display.phone}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Mail className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                  {display.email}
                </div>
                {display.address && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                    {display.address}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Care plan + clinical status */}
        <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("patientChart.carePlan")}
              </p>
              {editingPlan ? (
                <input
                  type="number"
                  min={1}
                  max={200}
                  autoFocus
                  value={planDraft}
                  onChange={(e) => setPlanDraft(e.target.value)}
                  onBlur={commitPlan}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitPlan()
                    if (e.key === "Escape") setEditingPlan(false)
                  }}
                  dir="ltr"
                  className="w-20 rounded-lg border border-sky-200 bg-white px-2 py-0.5 font-mono text-sm tabular-nums text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-100"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPlanDraft(String(planTarget))
                    setEditingPlan(true)
                  }}
                  title={t("patientChart.carePlanEdit")}
                  className="font-mono text-sm font-semibold tabular-nums text-slate-800 underline-offset-2 hover:text-sky-700 hover:underline"
                >
                  {clampedDone}
                  <span className="font-normal text-slate-400">/{planTarget}</span>
                </button>
              )}
              <p className="text-[11px] text-slate-400">{t("patientChart.sessionsWord")}</p>
              {/* Said plainly rather than shown as a number that looks agreed.
                  A target nobody set for this patient is not their plan. */}
              {!planIsPersonal && !editingPlan && (
                <p className="text-[11px] text-slate-400">{t("patientChart.carePlanDefault")}</p>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
                aria-label={t("patientChart.carePlanProgressAria", { pct })}
              />
            </div>
          </div>

          <div className="hidden h-8 w-px bg-slate-100 sm:block" aria-hidden />

          {/* Clinical status.
              Always shown with where it came from and when. A status line with
              no date reads as current no matter how old it is, and that is what
              made the hard-coded demo sentence dangerous: it looked like a
              finding about this person. */}
          <div className="flex min-w-0 items-start gap-2">
            <p className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t("patientChart.clinicalStatus")}
            </p>
            {editingStatus ? (
              <input
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
                onBlur={commitStatus}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitStatus()
                  if (e.key === "Escape") {
                    setStatusDraft(clinicalStatus.manualText)
                    setEditingStatus(false)
                  }
                }}
                autoFocus
                className="w-full max-w-xs rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-100"
                placeholder={t("patientChart.clinicalStatusPh")}
              />
            ) : (
              <button
                type="button"
                onClick={openStatusEditor}
                title={t("patientChart.editStatusTitle")}
                className="min-w-0 text-start underline-offset-2 hover:underline"
              >
                {clinicalStatus.source === "none" ? (
                  <span className="text-sm italic text-slate-400">
                    {t("patientChart.clinicalStatusEmpty")}
                  </span>
                ) : (
                  <span dir="auto" className="block text-sm text-slate-600">
                    {clinicalStatus.text}
                  </span>
                )}
                {statusDate && (
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {clinicalStatus.source === "treatment"
                      ? t("patientChart.clinicalStatusFromVisit", { date: statusDate })
                      : t("patientChart.clinicalStatusWritten", { date: statusDate })}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Treatment map — collapsed by default */}
      <div className="border-t border-slate-100">
        <button
          type="button"
          onClick={() => setMapOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-6 py-3.5 text-start text-sm font-semibold text-slate-700 transition-colors hover:text-sky-700"
          aria-expanded={mapOpen}
          aria-controls="bodymap-panel"
        >
          <MapPin className="size-4 text-slate-400" aria-hidden />
          {t("patientChart.bodyMapTitle")}
          {mapOpen ? (
            <ChevronUp className="ms-auto size-4 text-slate-400" aria-hidden />
          ) : (
            <ChevronDown className="ms-auto size-4 text-slate-400" aria-hidden />
          )}
        </button>

        <div
          id="bodymap-panel"
          className={cn(
            "overflow-hidden transition-all duration-300",
            mapOpen ? "max-h-[2200px]" : "max-h-0",
          )}
        >
          <div className="border-t border-slate-100 px-6 pb-5 pt-4">
            {/* Mounted only once opened: the panel is collapsed by default and a
                WebGL context per chart visit is not free. */}
            {mapOpen && (
              <SkeletonViewer
                annotations={bodyMarks3d}
                onSave={onAddBodyMark3d}
                onDelete={onRemoveBodyMark3d}
                onUpdateNote={onUpdateBodyMark3dNote}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
