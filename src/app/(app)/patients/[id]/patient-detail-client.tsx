"use client"

import { notFound, useParams, useRouter } from "next/navigation"
import { useState, useCallback, useMemo } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronUp, Pencil, StickyNote, X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import {
  useMergedPatients,
  usePatientExtras,
} from "@/components/providers/patient-extras-provider"
import { localizePatient } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"
import { BillingToast } from "@/features/finances/components/billing-toast"
import { PatientSmartHeader } from "@/features/patients/components/patient-smart-header"
import { ExportButton, ExportDialog } from "@/features/exports/components/export-dialog"
import { buildPatientBundle, patientColumns } from "@/features/exports/lib/build-exports"
import { loadPatientExportSource } from "@/features/exports/lib/export-source"
import { datedFilename, downloadCsv, downloadJson } from "@/lib/file-export"
import { SessionCanvas } from "@/features/patients/components/session-canvas"
import { SessionAudio } from "@/features/patients/components/session-audio"
import { UnifiedTimeline } from "@/features/patients/components/unified-timeline"
import { PatientActionBar } from "@/features/patients/components/patient-action-bar"
import { usePatientCockpit } from "@/features/patients/lib/use-patient-cockpit"

export function PatientDetailClient() {
  const params = useParams()
  const router = useRouter()
  const { t, locale, formatMoney } = useLocale()
  const id =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""

  const { appointments } = useScheduleDay()
  const merged = useMergedPatients()
  const { loading: patientsLoading } = usePatientExtras()
  const patient = merged.find((entry) => entry.id === id)
  const displayPatient = useMemo(
    () => (patient ? localizePatient(patient, locale) : patient),
    [patient, locale],
  )

  /*
   * Wait before declaring a patient missing.
   *
   * The list arrives after mount, so for a moment `merged` holds only the demo
   * dataset — and every real patient looked like a 404 in that moment, which
   * reads as a deleted record rather than a slow one.
   *
   * `notFound()` never returns, so the hooks below still run in the same order
   * on every render that gets past it. A plain early return here would not, and
   * that is what the rules-of-hooks lint is protecting.
   */
  const stillLoadingPatients = patientsLoading && !patient
  if (!stillLoadingPatients && (!patient || !displayPatient || !id)) notFound()

  const {
    hydrated,
    saveError,
    clearSaveError,
    clinicalStatus,
    setClinicalStatus,
    sessionNotes,
    setSessionNotes,
    canvasStrokes,
    setCanvasStrokes,
    sessionAudioUrl,
    saveSessionAudio,
    clearSessionAudio,
    completedSessions,
    completeSession,
    deleteTreatmentRecord,
    deleteCompletedSession,
    treatmentRecords,
    treatmentsAreLive,
    documentRecords,
    financeRecords,
    outstandingDebt,
    totalSessionsDone,
    planTarget,
    planIsPersonal,
    setPlanTarget,
    lastAppointmentType,
    contactOverrides,
    saveContactOverrides,
    deleteDocumentRecord,
    treatmentMarks,
    addTreatmentMark,
    updateTreatmentMarkNote,
    removeTreatmentMark,
  } = usePatientCockpit(id)

  const [notesOpen, setNotesOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  })

  const showToast = useCallback((message: string) => {
    setToast({ open: true, message })
  }, [])

  /**
   * What kind of visit this is, taken from the patient's own diary rather than
   * from the demo day this used to read. The stored value is the fallback for a
   * patient with nothing booked.
   */
  const patientLastAppointmentType = (() => {
    const mine = appointments.filter((a) => a.patientId === id)
    if (mine.length > 0) return mine[mine.length - 1].appointmentType
    return lastAppointmentType
  })()

  const handleCompleteSession = async () => {
    // Only claim the session was recorded once it was. The old code toasted
    // unconditionally, which was harmless while the write went to localStorage
    // and cannot stay that way now that it can fail.
    const saved = await completeSession(patientLastAppointmentType)
    if (saved) showToast(t("patientChart.toast.sessionDone", { n: totalSessionsDone + 1 }))
  }

  /**
   * Billing lives on the Finances page and nowhere else.
   *
   * This button used to show a toast and do nothing at all, which is the worst
   * possible answer: a practitioner would believe an invoice had been issued.
   * It now hands the work to the one flow that really issues a document —
   * against the clinic's bookkeeping account, with its own confirmation.
   */
  const handleIssueInvoice = () => {
    router.push("/finances")
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        {t("patientChart.loading")}
      </div>
    )
  }

  // `patient` is narrowed here too: past this point `notFound()` has already
  // run for anything genuinely missing, and everything below needs both.
  if (stillLoadingPatients || !patient || !displayPatient) {
    return <div className="py-16 text-center text-sm text-slate-400">{t("public.loading")}</div>
  }

  const slug = displayPatient.fullName.replace(/\s+/g, "-").toLowerCase()

  return (
    <>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title={t("export.patientRecord")}
        subtitle={t("export.patientRecordSubtitle", { name: displayPatient.fullName })}
        csvLabel={t("export.csvDetails")}
        jsonLabel={t("export.jsonFullRecord")}
        onExportCsv={async (options) => {
          // CSV holds the contact row only — a chart is nested data and a
          // single flat row cannot carry its timeline.
          const source = await loadPatientExportSource(patient, formatMoney)
          downloadCsv(
            patientColumns(options, source),
            [patient],
            datedFilename(`patient-${slug}`, "csv"),
          )
          setExportOpen(false)
        }}
        onExportJson={async (options) => {
          // Built from this patient's own records. It used to look the patient
          // up in the demo file, so for a real one the bundle came back null
          // and the button quietly produced nothing at all.
          const source = await loadPatientExportSource(patient, formatMoney)
          const bundle = buildPatientBundle(id, options, source)
          if (bundle) downloadJson(bundle, datedFilename(`patient-${slug}`, "json"))
          setExportOpen(false)
        }}
      />

      <div className="flex gap-6 pb-28 xl:pb-8">
        {/* ── Main column ── */}
        <div className="min-w-0 flex-1 space-y-6 sm:space-y-8">
          <PatientSmartHeader
            patient={displayPatient}
            overrides={contactOverrides}
            totalSessionsDone={totalSessionsDone}
            planTarget={planTarget}
            planIsPersonal={planIsPersonal}
            onPlanTargetChange={setPlanTarget}
            clinicalStatus={clinicalStatus}
            onClinicalStatusChange={setClinicalStatus}
            onSaveOverrides={saveContactOverrides}
            treatmentMarks={treatmentMarks}
            onAddTreatmentMark={addTreatmentMark}
            onUpdateTreatmentMarkNote={updateTreatmentMarkNote}
            onRemoveTreatmentMark={removeTreatmentMark}
          />

          <div className="flex justify-end">
            <ExportButton onClick={() => setExportOpen(true)} label={t("export.patientRecord")} />
          </div>

          <section id="active-session" aria-labelledby="session-heading" className="scroll-mt-24">
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.09)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2
                  id="session-heading"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  {t("patientChart.activeSession")}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-slate-400">
                    {t("patientChart.sessionProgress", {
                      current: totalSessionsDone + 1,
                      total: planTarget,
                    })}
                  </span>
                  <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    {t("patientChart.live")}
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <SessionCanvas
                  key={id}
                  initialStrokes={canvasStrokes}
                  onStrokesChange={setCanvasStrokes}
                />

                <SessionAudio
                  audioUrl={sessionAudioUrl}
                  onRecorded={saveSessionAudio}
                  onDelete={clearSessionAudio}
                />

                <div className="rounded-2xl border border-slate-100 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setNotesOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm font-semibold text-slate-700 transition-colors hover:text-sky-700"
                    aria-expanded={notesOpen}
                    aria-controls="session-notes-panel"
                  >
                    <StickyNote className="size-4 text-slate-400" aria-hidden />
                    {t("patientChart.sessionNotes")}
                    {notesOpen ? (
                      <ChevronUp className="ms-auto size-4 text-slate-400" aria-hidden />
                    ) : (
                      <ChevronDown className="ms-auto size-4 text-slate-400" aria-hidden />
                    )}
                  </button>

                  <div
                    id="session-notes-panel"
                    className={cn(
                      "overflow-hidden transition-all duration-300",
                      notesOpen ? "max-h-[400px]" : "max-h-0",
                    )}
                  >
                    <div className="border-t border-slate-100 p-4">
                      <textarea
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder={t("patientChart.sessionNotesPh")}
                        rows={5}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 placeholder-slate-400 outline-none transition-[border-color,box-shadow] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="timeline-heading">
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.09)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2
                  id="timeline-heading"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  {t("patientChart.timelineTitle")}
                </h2>
              </div>
              <div className="p-5 pb-3">
                <UnifiedTimeline
                  treatmentRecords={treatmentRecords}
                  documentRecords={documentRecords}
                  financeRecords={financeRecords}
                  completedSessions={completedSessions}
                  planTarget={planTarget}
                  treatmentsAreLive={treatmentsAreLive}
                  onDeleteTreatment={deleteTreatmentRecord}
                  onDeleteCompletedSession={deleteCompletedSession}
                />
              </div>
            </div>
          </section>

          <GeneralNotesCard
            initialValue={contactOverrides.generalNotes ?? displayPatient.generalNotes ?? ""}
            onSave={(v) =>
              saveContactOverrides({ ...contactOverrides, generalNotes: v })
            }
          />
        </div>

        <div id="patient-actions" className="scroll-mt-24">
          <PatientActionBar
            outstandingDebt={outstandingDebt ?? 0}
            onCompleteSession={handleCompleteSession}
            onIssueInvoice={handleIssueInvoice}
            patientId={id}
            patientName={displayPatient.fullName}
            documentRecords={documentRecords}
            onDeleteDocument={deleteDocumentRecord}
            lastAppointmentType={patientLastAppointmentType}
            nextSessionNumber={totalSessionsDone + 1}
          />
        </div>
      </div>

      <BillingToast
        open={toast.open}
        message={toast.message}
        onOpenChange={(v) => setToast((st) => ({ ...st, open: v }))}
      />

      {/* A write that did not reach the database has to say so. Everything on
          this page used to be saved to the browser, where nothing could fail;
          now that it goes to Postgres, a silent failure would leave a
          practitioner believing a note was recorded when it was not. */}
      {saveError && (
        <div
          role="alert"
          className="fixed bottom-6 end-6 z-[100] flex max-w-sm items-start gap-2.5 rounded-xl border border-rose-200/80 bg-white px-4 py-3 shadow-lg ring-1 ring-slate-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
          <p className="text-sm font-medium leading-snug text-slate-800">
            {t("patientChart.saveFailed")}
          </p>
          <button
            type="button"
            onClick={clearSaveError}
            className="ms-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
            aria-label={t("common.cancel")}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

/**
 * Editable General Notes card. Inline pencil → textarea; Save/Cancel persist
 * the override via the cockpit hook.
 */
function GeneralNotesCard({
  initialValue,
  onSave,
}: {
  initialValue: string
  onSave: (value: string) => void
}) {
  const { t } = useLocale()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialValue)

  const enterEdit = () => {
    setDraft(initialValue)
    setEditing(true)
  }
  const cancel = () => setEditing(false)
  const save = () => {
    onSave(draft.trim())
    setEditing(false)
  }

  return (
    <section>
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.09)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("patientChart.generalNotes")}
          </h2>
          {!editing ? (
            <button
              type="button"
              onClick={enterEdit}
              className="flex items-center gap-1 rounded-md border border-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-sky-200 hover:text-sky-600"
              aria-label={t("patientChart.editGeneralNotesAria")}
            >
              <Pencil className="size-2.5" aria-hidden />
              {t("common.edit")}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={save}
                className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Check className="size-2.5" aria-hidden />
                {t("common.save")}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50"
              >
                <X className="size-2.5" aria-hidden />
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
        <div className="px-5 py-4">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
              placeholder={t("patientChart.generalNotesPh")}
            />
          ) : (
            <p className="text-sm leading-relaxed text-slate-500">
              {initialValue || (
                <span className="italic text-slate-400">{t("patientChart.noGeneralNotes")}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
