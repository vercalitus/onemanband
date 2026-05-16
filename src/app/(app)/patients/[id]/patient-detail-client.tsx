"use client"

import { notFound, useParams } from "next/navigation"
import { useState, useCallback } from "react"
import { ChevronDown, ChevronUp, StickyNote } from "lucide-react"

import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { cn } from "@/lib/utils"
import { BillingToast } from "@/features/finances/components/billing-toast"
import { PatientSmartHeader } from "@/features/patients/components/patient-smart-header"
import { SessionCanvas } from "@/features/patients/components/session-canvas"
import { UnifiedTimeline } from "@/features/patients/components/unified-timeline"
import { PatientActionBar } from "@/features/patients/components/patient-action-bar"
import { usePatientCockpit } from "@/features/patients/lib/use-patient-cockpit"

export function PatientDetailClient() {
  const params = useParams()
  const id =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""

  const merged = useMergedPatients()
  const patient = merged.find((entry) => entry.id === id)

  if (!patient || !id) notFound()

  const {
    hydrated,
    clinicalStatus,
    setClinicalStatus,
    sessionNotes,
    setSessionNotes,
    canvasDataUrl,
    setCanvasDataUrl,
    completedSessions,
    completeSession,
    treatmentRecords,
    documentRecords,
    financeRecords,
    totalSessionsDone,
    planTarget,
  } = usePatientCockpit(id)

  const [notesOpen, setNotesOpen] = useState(true)
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  })

  const showToast = useCallback((message: string) => {
    setToast({ open: true, message })
  }, [])

  const handleCompleteSession = () => {
    completeSession()
    showToast("Session marked as complete — timeline updated.")
  }

  const handleIssueInvoice = () => {
    showToast("Invoice generated and sent to billing.")
  }

  /** Rough outstanding debt based on mock finance records */
  const outstandingDebt = financeRecords
    .filter((r) => r.invoiceStatus === "overdue" || r.paymentStatus === "pending")
    .reduce((sum, r) => {
      const n = parseInt(r.amount.replace(/[^0-9]/g, ""), 10)
      return sum + (isNaN(n) ? 0 : n)
    }, 0)

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <>
      {/* Page body — extra bottom padding so sticky bar never covers content */}
      <div className="flex gap-6 pb-28 xl:pb-8">
        {/* ── Main column ── */}
        <div className="min-w-0 flex-1 space-y-6 sm:space-y-8">
          {/* 1. Smart Header */}
          <PatientSmartHeader
            patient={patient}
            totalSessionsDone={totalSessionsDone}
            planTarget={planTarget}
            clinicalStatus={clinicalStatus}
            onClinicalStatusChange={setClinicalStatus}
          />

          {/* 2. Active Session Area */}
          <section aria-labelledby="session-heading">
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.09)]">
              {/* Section header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2
                  id="session-heading"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  Active Session
                </h2>
                <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Live
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* Canvas */}
                <SessionCanvas
                  initialDataUrl={canvasDataUrl}
                  onSave={setCanvasDataUrl}
                />

                {/* Collapsible text notes */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setNotesOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:text-sky-700"
                    aria-expanded={notesOpen}
                    aria-controls="session-notes-panel"
                  >
                    <StickyNote className="size-4 text-slate-400" aria-hidden />
                    Session notes
                    {notesOpen ? (
                      <ChevronUp className="ml-auto size-4 text-slate-400" aria-hidden />
                    ) : (
                      <ChevronDown className="ml-auto size-4 text-slate-400" aria-hidden />
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
                        placeholder="Type structured notes, findings, adjustments made…"
                        rows={5}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 placeholder-slate-400 outline-none transition-[border-color,box-shadow] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Unified Timeline */}
          <section aria-labelledby="timeline-heading">
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.09)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2
                  id="timeline-heading"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  Patient Timeline
                </h2>
              </div>
              <div className="p-5 pb-3">
                <UnifiedTimeline
                  treatmentRecords={treatmentRecords}
                  documentRecords={documentRecords}
                  financeRecords={financeRecords}
                  completedSessions={completedSessions}
                />
              </div>
            </div>
          </section>

          {/* General notes card (non-editable summary) */}
          {patient.generalNotes && (
            <section>
              <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.09)]">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    General Notes
                  </h2>
                </div>
                <p className="px-5 py-4 text-sm leading-relaxed text-slate-500">
                  {patient.generalNotes}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* ── Desktop: Quick-actions sidebar (rendered inside PatientActionBar) ── */}
        <PatientActionBar
          outstandingDebt={outstandingDebt}
          onCompleteSession={handleCompleteSession}
          onIssueInvoice={handleIssueInvoice}
          patientId={id}
          patientName={patient.fullName}
        />
      </div>

      {/* Toast */}
      <BillingToast
        open={toast.open}
        message={toast.message}
        onOpenChange={(v) => setToast((t) => ({ ...t, open: v }))}
      />
    </>
  )
}
