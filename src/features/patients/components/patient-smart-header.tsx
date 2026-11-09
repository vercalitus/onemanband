"use client"

import { Check, ChevronDown, ChevronUp, Mail, MapPin, Pencil, Phone, X } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { BodyMapViewer } from "@/features/body-map/components/body-map-viewer"
import { regionLabel, spineLabel } from "@/features/body-map/lib/regions"
import { PaymentClaimBadge } from "@/features/finances/components/payment-claim-badge"
import { usePaymentClaims } from "@/features/finances/lib/use-payment-claims"
import { cn } from "@/lib/utils"
import { markTones } from "@/types/domain"
import type { BodyMark, BodyMark3d, BodyMarkTone, PatientSummary } from "@/types/domain"
import type { ClinicalStatus, PatientContactOverrides } from "../lib/use-patient-cockpit"

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
  /** The most recent visit on record, as the timeline shows it. Null when there is none. */
  lastVisit?: { date: string; title: string } | null
  bodyMarks: BodyMark[]
  /** The skeleton's marks, from before the figures. Shown, never edited. */
  bodyMarks3d: BodyMark3d[]
  onAddBodyMark: (mark: Omit<BodyMark, "id" | "createdAt">) => void
  onUpdateBodyMarkNote: (id: string, note: string) => void
  onUpdateBodyMarkTones: (id: string, tones: BodyMarkTone[]) => void
  onRemoveBodyMark: (id: string) => void
}

const FIELD_CLASS =
  "w-full rounded-md border border-hair bg-paper px-3 py-2 text-[17px] text-ink outline-none placeholder:text-faint focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"

/** A region of the briefing strip: a quiet label, then what it says. */
function BriefCell({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 lg:border-s lg:border-hair-soft lg:px-5 lg:first:border-s-0 lg:first:ps-0 lg:last:pe-0",
        className,
      )}
    >
      <p className="mb-1 text-sm leading-snug font-medium text-mute">{label}</p>
      {children}
    </div>
  )
}

/**
 * What the body map says, in words: one line per kind of finding, with the
 * places it was marked on. Read from the marks themselves — the same names the
 * map uses — so the strip never says anything the map does not.
 */
function useMarkLines(marks: BodyMark[]) {
  const { t } = useLocale()
  const lines: { key: string; kind: string; where: string }[] = []
  for (const m of marks) {
    const places = [...m.regions, ...m.vertebrae]
    const name = (id: string) => (m.vertebrae.includes(id) ? spineLabel(t, id) : regionLabel(t, id))
    if (m.kinds && Object.keys(m.kinds).length > 0) {
      const byKind = new Map<BodyMarkTone, string[]>()
      for (const id of places) {
        const kind = m.kinds[id]
        if (!kind) continue
        byKind.set(kind, [...(byKind.get(kind) ?? []), id])
      }
      for (const [kind, ids] of byKind) {
        lines.push({
          key: `${m.id}-${kind}`,
          kind: t(`bodyMap.tone.${kind}`),
          where: ids.map(name).join(", "),
        })
      }
      if (byKind.size > 0) continue
    }
    const tones = markTones(m)
    lines.push({
      key: m.id,
      kind: tones.length
        ? tones.map((tone) => t(`bodyMap.tone.${tone}`)).join(" + ")
        : t("bodyMap.tone.unclassified"),
      where: places.length ? places.map(name).join(", ") : (m.note ?? ""),
    })
  }
  return lines
}

const MAX_MARK_LINES = 3

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
  lastVisit,
  bodyMarks,
  bodyMarks3d,
  onAddBodyMark,
  onUpdateBodyMarkNote,
  onUpdateBodyMarkTones,
  onRemoveBodyMark,
}: Props) {
  const { t, localeTag } = useLocale()
  const paymentClaimed = usePaymentClaims().patients.has(patient.id)
  const [mapOpen, setMapOpen] = useState(false)
  const clampedDone = Math.min(totalSessionsDone, planTarget)
  const markLines = useMarkLines(bodyMarks)
  const placeCount = bodyMarks.reduce((n, m) => n + m.regions.length + m.vertebrae.length, 0)

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

  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  const statusDate = clinicalStatus.at ? dateOf(clinicalStatus.at) : null

  return (
    <section className="overflow-hidden rounded-md border border-hair bg-paper">
      {/* ── Briefing: four facts read before the patient walks in ── */}
      <div className="grid gap-x-6 gap-y-5 px-5 py-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-x-0">
        {/* Clinical status.
            Always shown with where it came from and when. A status line with
            no date reads as current no matter how old it is, and that is what
            made the hard-coded demo sentence dangerous: it looked like a
            finding about this person. */}
        <BriefCell
          label={
            <>
              {t("patientChart.clinicalStatus")}
              {statusDate && (
                <span className="font-normal">
                  {" · "}
                  {clinicalStatus.source === "treatment"
                    ? t("patientChart.clinicalStatusFromVisit", { date: statusDate })
                    : t("patientChart.clinicalStatusWritten", { date: statusDate })}
                </span>
              )}
            </>
          }
        >
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
              className={cn(FIELD_CLASS, "min-h-11")}
              placeholder={t("patientChart.clinicalStatusPh")}
            />
          ) : (
            <button
              type="button"
              onClick={openStatusEditor}
              title={t("patientChart.editStatusTitle")}
              className="-mx-1 block min-h-11 w-full rounded-md px-1 text-start decoration-hair underline-offset-4 hover:underline"
            >
              {clinicalStatus.source === "none" ? (
                <span className="text-[17px] leading-snug text-faint italic">
                  {t("patientChart.clinicalStatusEmpty")}
                </span>
              ) : (
                <span dir="auto" className="line-clamp-3 text-[17px] leading-snug text-ink">
                  {clinicalStatus.text}
                </span>
              )}
            </button>
          )}
        </BriefCell>

        <BriefCell label={t("patientChart.brief.lastVisit")}>
          {lastVisit ? (
            <p className="text-[17px] leading-snug text-ink">
              <span className="tabular-nums">{dateOf(lastVisit.date)}</span>
              {lastVisit.title && (
                <>
                  {" · "}
                  <span dir="auto">{lastVisit.title}</span>
                </>
              )}
            </p>
          ) : (
            <p className="text-[17px] leading-snug text-faint italic">{t("patientChart.brief.noVisit")}</p>
          )}
        </BriefCell>

        <BriefCell label={t("patientChart.brief.history")}>
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
            <p dir="auto" className="line-clamp-4 text-[17px] leading-snug text-ink">
              {display.medicalHistorySummary}
            </p>
          )}
        </BriefCell>

        <BriefCell
          label={
            <>
              {t("patientChart.bodyMapTitle")}
              {placeCount > 0 && (
                <span className="font-normal tabular-nums">{" · "}{t("bodyMap.count", { n: placeCount })}</span>
              )}
            </>
          }
        >
          {markLines.length === 0 ? (
            <p className="text-[17px] leading-snug text-faint italic">{t("patientChart.brief.noMarks")}</p>
          ) : (
            <ul className="grid gap-0.5 text-sm leading-snug text-ink">
              {markLines.slice(0, MAX_MARK_LINES).map((line) => (
                <li key={line.key} className="line-clamp-2">
                  <b className="font-bold">{line.kind}</b>
                  {line.where && <> · {line.where}</>}
                </li>
              ))}
              {markLines.length > MAX_MARK_LINES && (
                <li className="text-mute">
                  {t("patientChart.brief.moreMarks", { n: markLines.length - MAX_MARK_LINES })}
                </li>
              )}
            </ul>
          )}
        </BriefCell>
      </div>

      {/* ── Details: who they are on paper, the plan, how to reach them ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair-soft px-5 py-2.5 text-sm text-ink">
        <div className="flex flex-wrap items-center gap-2">
          {onStatusChange ? (
            /* The badge is the control. A separate "edit status" affordance
               would be one more thing on a crowded header for a change made
               a few times a year.

               It needed a chevron, though: stripped of the browser's own
               arrow it was indistinguishable from the read-only badge
               beside it, and the practitioner went looking through Settings
               for a way to freeze a patient. */
            <span className="relative inline-flex items-center">
              <select
                value={patient.status}
                onChange={(e) => onStatusChange(e.target.value as PatientSummary["status"])}
                aria-label={t("patientChart.statusChangeAria")}
                title={t("patientChart.statusChangeAria")}
                className="h-11 cursor-pointer appearance-none rounded-md border border-hair bg-paper ps-3 pe-8 text-sm font-medium text-ink capitalize outline-none hover:bg-ground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
              >
                {(["active", "frozen", "past"] as const).map((status) => (
                  <option key={status} value={status}>
                    {t(`status.patient.${status}`)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute end-2.5 size-4 text-mute"
                aria-hidden
              />
            </span>
          ) : (
            <span className="inline-flex h-11 items-center rounded-md border border-hair px-3 text-sm font-medium capitalize">
              {t(`status.patient.${patient.status}`)}
            </span>
          )}
          {/* Only ever shown for an open claim — an unpaid or settled
              account says so on the Billing page, but "says they paid"
              needs answering, so it follows the patient around. */}
          {paymentClaimed && <PaymentClaimBadge />}

          {/* The plan's length. The count itself is on the plate. */}
          {editingPlan ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-medium text-mute">{t("patientChart.carePlan")}</span>
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
                className="h-11 w-20 rounded-md border border-cobalt bg-paper px-2 text-[17px] tabular-nums text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
              />
              <span className="text-mute">{t("patientChart.sessionsWord")}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPlanDraft(String(planTarget))
                setEditingPlan(true)
              }}
              title={t("patientChart.carePlanEdit")}
              className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 hover:bg-ground"
            >
              <span className="font-medium text-mute">{t("patientChart.carePlan")}</span>
              <span className="font-bold tabular-nums">
                {clampedDone}
                <span className="font-normal text-mute">/{planTarget}</span>
              </span>
              <span className="text-mute">{t("patientChart.sessionsWord")}</span>
              {/* Said plainly rather than shown as a number that looks agreed.
                  A target nobody set for this patient is not their plan. */}
              {!planIsPersonal && (
                <span className="text-mute">· {t("patientChart.carePlanDefault")}</span>
              )}
            </button>
          )}
        </div>

        {/* Contact card */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
          <span className="sr-only">{t("patientChart.contact")}</span>
          {editing ? (
            <div className="grid w-full gap-2 sm:grid-cols-3">
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
            <>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Phone className="size-4 shrink-0 text-mute" aria-hidden />
                <bdi className="tabular-nums">{display.phone}</bdi>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="size-4 shrink-0 text-mute" aria-hidden />
                <bdi className="max-w-64 truncate">{display.email}</bdi>
              </span>
              {display.address && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-4 shrink-0 text-mute" aria-hidden />
                  <span className="max-w-64 truncate">{display.address}</span>
                </span>
              )}
            </>
          )}
          {!editing ? (
            <Button
              variant="outline"
              size="icon"
              onClick={enterEdit}
              title={t("patientChart.editContactAria")}
              aria-label={t("patientChart.editContactAria")}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={cancelEdit} className="text-sm">
                <X aria-hidden />
                {t("common.cancel")}
              </Button>
              <Button variant="outline" onClick={saveEdit} className="border-cobalt text-sm">
                <Check aria-hidden />
                {t("common.save")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Treatment map — collapsed by default */}
      <div className="border-t border-hair-soft">
        <button
          type="button"
          onClick={() => setMapOpen((v) => !v)}
          className="flex min-h-13 w-full items-center gap-2 px-5 text-start text-[17px] font-bold text-ink transition-colors hover:bg-ground"
          aria-expanded={mapOpen}
          aria-controls="bodymap-panel"
        >
          <MapPin className="size-5 text-mute" aria-hidden />
          {t("patientChart.bodyMapTitle")}
          {mapOpen ? (
            <ChevronUp className="ms-auto size-5 text-mute" aria-hidden />
          ) : (
            <ChevronDown className="ms-auto size-5 text-mute" aria-hidden />
          )}
        </button>

        <div
          id="bodymap-panel"
          className={cn(
            "overflow-hidden transition-all duration-300",
            mapOpen ? "max-h-[4000px]" : "max-h-0",
          )}
        >
          <div className="border-t border-hair-soft px-5 pt-4 pb-5">
            {/* Mounted only once opened: the panel is collapsed by default, and
                a mounted map keeps an unsaved draft it would flush on leaving. */}
            {mapOpen && (
              <BodyMapViewer
                marks={bodyMarks}
                legacyMarks={bodyMarks3d}
                onSave={onAddBodyMark}
                onDelete={onRemoveBodyMark}
                onUpdateNote={onUpdateBodyMarkNote}
                onUpdateTones={onUpdateBodyMarkTones}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
