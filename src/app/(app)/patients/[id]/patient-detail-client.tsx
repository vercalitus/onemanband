"use client"

import { notFound, useParams } from "next/navigation"
import { useState, useCallback, useMemo } from "react"
import { Check, ChevronDown, ChevronUp, Pencil, StickyNote, X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { localizePatient } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"
import { BillingToast } from "@/features/finances/components/billing-toast"
import { PatientSmartHeader } from "@/features/patients/components/patient-smart-header"
import { SessionCanvas } from "@/features/patients/components/session-canvas"
import { SessionAudio } from "@/features/patients/components/session-audio"
import { UnifiedTimeline } from "@/features/patients/components/unified-timeline"
import { PatientActionBar } from "@/features/patients/components/patient-action-bar"
import { usePatientCockpit } from "@/features/patients/lib/use-patient-cockpit"
import { todaySchedule } from "@/lib/mock-data"

export function PatientDetailClient() {
  const params = useParams()
  const { t, locale } = useLocale()
  const id =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""

  const merged = useMergedPatients()
  const patient = merged.find((entry) => entry.id === id)
  const displayPatient = useMemo(
    () => (patient ? localizePatient(patient, locale) : patient),
    [patient, locale],
  )

  if (!patient || !displayPatient || !id) notFound()

  const {
    hydrated,
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
    documentRecords,
    financeRecords,
    totalSessionsDone,
    planTarget,
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
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  })

  const showToast = useCallback((message: string) => {
    setToast({ open: true, message })
  }, [])

  /** Find the last appointment type for this patient from today's schedule */
  const patientLastAppointmentType = (() => {
    const patientAppts = todaySchedule.filter((a) => a.patientId === id)
    if (patientAppts.length > 0) return patientAppts[patientAppts.length - 1].appointmentType
    return lastAppointmentType
  })()

  const handleCompleteSession = () => {
    void completeSession(patientLastAppointmentType)
    showToast(t("patientChart.toast.sessionDone", { n: totalSessionsDone + 1 }))
  }

  const handleIssueInvoice = () => {
    showToast(t("patientChart.toast.invoice"))
  }

  /** Outstanding debt from mock finance records */
  const outstandingDebt = financeRecords
    .filter((r) => r.invoiceStatus === "overdue" || r.paymentStatus === "pending")
    .reduce((sum, r) => {
      const n = parseInt(r.amount.replace(/[^0-9]/g, ""), 10)
      return sum + (isNaN(n) ? 0 : n)
    }, 0)

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        {t("patientChart.loading")}
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-6 pb-28 xl:pb-8">
        {/* ── Main column ── */}
        <div className="min-w-0 flex-1 space-y-6 sm:space-y-8">
          <PatientSmartHeader
            patient={displayPatient}
            overrides={contactOverrides}
            totalSessionsDone={totalSessionsDone}
            planTarget={planTarget}
            clinicalStatus={clinicalStatus}
            onClinicalStatusChange={setClinicalStatus}
            onSaveOverrides={saveContactOverrides}
            treatmentMarks={treatmentMarks}
            onAddTreatmentMark={addTreatmentMark}
            onUpdateTreatmentMarkNote={updateTreatmentMarkNote}
            onRemoveTreatmentMark={removeTreatmentMark}
          />

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
            outstandingDebt={outstandingDebt}
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
