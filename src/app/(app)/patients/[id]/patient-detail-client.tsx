"use client"

import { notFound, useParams, useRouter, useSearchParams } from "next/navigation"
import { useState, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Ellipsis,
  Pencil,
  Receipt,
  StickyNote,
  X,
} from "lucide-react"

import { PagePlate, PlateDebt, PlateDivider, PlateFact, PlateSpacer } from "@/components/layout/page-plate"
import { useLocale } from "@/components/providers/locale-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StateLegend } from "@/components/ui/state-mark"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StateMark } from "@/components/ui/state-mark"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { getTreatmentPriceIls } from "@/lib/clinic-settings-storage"
import { toISODate } from "@/lib/date-helpers"
import type { PaymentMethod } from "@/types/domain"
import {
  useMergedPatients,
  usePatientExtras,
} from "@/components/providers/patient-extras-provider"
import { localizeCompletedSessionTitle, localizePatient } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"
import { BillingToast } from "@/features/finances/components/billing-toast"
import { PatientSmartHeader } from "@/features/patients/components/patient-smart-header"
import { ExportDialog } from "@/features/exports/components/export-dialog"
import { buildPatientBundle, patientColumns } from "@/features/exports/lib/build-exports"
import { loadPatientExportSource } from "@/features/exports/lib/export-source"
import { datedFilename, downloadCsv, downloadJson } from "@/lib/file-export"
import { SessionCanvas } from "@/features/patients/components/session-canvas"
import { SessionCloseDialog } from "@/features/patients/components/session-close-dialog"
import { BODY_MAP_FLUSH_EVENT } from "@/features/body-map/lib/flush-event"
import { SessionAudio } from "@/features/patients/components/session-audio"
import { SessionSpine } from "@/features/patients/components/session-spine"
import { useSessionClosing } from "@/features/patients/lib/use-close-session"
import { UnifiedTimeline } from "@/features/patients/components/unified-timeline"
import { PatientActionBar } from "@/features/patients/components/patient-action-bar"
import { PatientLibrary } from "@/features/patients/components/patient-library"
import { usePatientCockpit } from "@/features/patients/lib/use-patient-cockpit"

export function PatientDetailClient() {
  const params = useParams()
  const router = useRouter()
  const { t, locale, localeTag, formatMoney } = useLocale()
  const id =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""

  const { appointments, openCreateAppointment } = useScheduleDay()
  // Set when the dashboard sends a visit that ended without being closed.
  const visitId = useSearchParams().get("visit")
  const { todaysAppointment, nextAppointment, closeSession } = useSessionClosing(id, visitId)
  const merged = useMergedPatients()
  const {
    loading: patientsLoading,
    error: patientsError,
    refreshLive,
  } = usePatientExtras()
  const patient = merged.find((entry) => entry.id === id)
  const displayPatient = useMemo(
    () => (patient ? localizePatient(patient, locale) : patient),
    [patient, locale],
  )

  /*
   * Say "not found" only when the record really is not there.
   *
   * Two things have to be ruled out first, and both were being reported to the
   * practitioner as a missing patient:
   *
   *  - **Still loading.** The list arrives after mount, so for a moment
   *    `merged` holds only the demo dataset and every real patient looks like a
   *    404 — a deleted record rather than a slow one.
   *  - **The list could not be read at all.** One dropped request and the chart
   *    said the patient did not exist. On a phone, reading a thousand rows
   *    fails often enough that a practitioner met "404 — this page could not be
   *    found" on a patient who was sitting in front of him.
   *
   * `notFound()` never returns, so the hooks below still run in the same order
   * on every render that gets past it. A plain early return here would not, and
   * that is what the rules-of-hooks lint is protecting.
   */
  const stillLoadingPatients = patientsLoading && !patient
  const listUnavailable = !!patientsError && !patient
  if (!stillLoadingPatients && !listUnavailable && (!patient || !displayPatient || !id)) {
    notFound()
  }

  const {
    hydrated,
    live,
    saveError,
    clearSaveError,
    clinicalStatus,
    setClinicalStatus,
    setPatientStatus,
    uploadDocumentRecord,
    voidTreatmentRecord,
    sessionNotes,
    setSessionNotes,
    canvasStrokes,
    setCanvasStrokes,
    sessionSpine,
    toggleSessionSpine,
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
    bodyMarks,
    bodyMarks3d,
    addBodyMark,
    updateBodyMarkNote,
    updateBodyMarkTones,
    removeBodyMark,
  } = usePatientCockpit(id)

  const [notesOpen, setNotesOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
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

  /** Book the next visit from inside the closing sheet, a week out by default. */
  const openScheduleNext = () => {
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    openCreateAppointment(
      toISODate(nextWeek),
      { id, name: displayPatient?.fullName ?? "" },
      { appointmentType: patientLastAppointmentType },
    )
  }

  /**
   * Close the session: the record first, then everything that follows from it.
   *
   * The record is the anchor and nothing else happens without it. A charge
   * raised for a visit that was never written down would be a debt with no
   * treatment behind it — which is exactly the kind of row nobody can explain
   * three months later.
   */
  const handleCloseSession = async ({
    amount,
    paid,
    method,
  }: {
    amount: number
    paid: boolean
    method: PaymentMethod
  }) => {
    // The type of visit being closed is today's booking, falling back to the
    // last one recorded for a session with nothing in the diary.
    const type = todaysAppointment?.appointmentType ?? patientLastAppointmentType
    // A spot marked on the body map but never saved belongs to this session too.
    window.dispatchEvent(new Event(BODY_MAP_FLUSH_EVENT))
    // Only claim the session was recorded once it was. The old code toasted
    // unconditionally, which was harmless while the write went to localStorage
    // and cannot stay that way now that it can fail.
    const saved = await completeSession(type)
    if (!saved) return null

    const outcome = await closeSession({
      patientId: id,
      patientName: patient?.fullName ?? "",
      appointmentType: type,
      amount,
      paid,
      method,
    })
    showToast(t("patientChart.toast.sessionDone", { n: totalSessionsDone + 1 }))
    return outcome
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
      <div className="flex items-center justify-center py-20 text-[17px] text-mute">
        {t("patientChart.loading")}
      </div>
    )
  }

  // A failure says so, and offers the one thing that fixes it. Rendered after
  // the hooks for the same reason `notFound()` is called before them.
  if (listUnavailable) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <AlertTriangle className="mx-auto mb-3 size-7 text-ink" aria-hidden />
        <p className="text-[17px] font-bold text-ink">{t("patientChart.loadFailed")}</p>
        <p className="mt-1 text-sm text-mute">{t("patientChart.loadFailedHint")}</p>
        <Button onClick={refreshLive} className="mt-4">
          {t("patientChart.retry")}
        </Button>
      </div>
    )
  }

  // `patient` is narrowed here too: past this point `notFound()` has already
  // run for anything genuinely missing, and everything below needs both.
  if (stillLoadingPatients || !patient || !displayPatient) {
    return <div className="py-16 text-center text-[17px] text-mute">{t("public.loading")}</div>
  }

  const slug = displayPatient.fullName.replace(/\s+/g, "-").toLowerCase()

  /** The most recent visit on record, named the way the timeline names it. */
  const lastVisit =
    [
      ...treatmentRecords
        .filter((r) => !r.voidedAt)
        .map((r) => ({ date: r.recordedAt, title: r.title })),
      ...completedSessions.map((cs) => ({
        date: cs.completedAt,
        title: localizeCompletedSessionTitle(cs.title, locale, t),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null

  const debt = outstandingDebt ?? 0
  const currentSession = totalSessionsDone + 1
  const pastPlan = totalSessionsDone >= planTarget

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

      {/* The plate: who this is, the visit, where they are in the plan, what
          they owe — and the one orange action, closing the session. */}
      <PagePlate>
        <div className="min-w-0 max-w-full">
          <h1 dir="auto" className="truncate font-display text-[40px] leading-[0.95] text-white sm:text-[56px]">
            {displayPatient.fullName}
          </h1>
          <p className="mt-1.5 truncate text-sm text-white/80">
            {t(`status.patient.${patient.status}`)}
            {" · "}
            <bdi className="tabular-nums">{contactOverrides.phone ?? displayPatient.phone}</bdi>
          </p>
        </div>
        {todaysAppointment && (
          <>
            <PlateDivider />
            <PlateFact
              display
              label={t("patientChart.plate.visitToday", { end: todaysAppointment.end })}
            >
              {todaysAppointment.start}
            </PlateFact>
          </>
        )}
        <PlateDivider />
        {/*
          "Session 12 of 8" is not a sentence. Once the plan has been
          worked through, the honest thing to say is that it has — the
          count keeps running, the target stops pretending to bound it.
        */}
        <PlateFact
          display
          label={
            pastPlan
              ? t("patientChart.plate.sessionPastPlan", { total: planTarget })
              : t("patientChart.plate.session", { total: planTarget })
          }
        >
          {pastPlan ? currentSession : `${currentSession}/${planTarget}`}
        </PlateFact>
        <PlateSpacer />
        {debt > 0 && (
          <button
            type="button"
            onClick={handleIssueInvoice}
            className="rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={t("patientChart.issueInvoiceDebtAria", {
              detail: t("patientChart.outstandingDebt", { amount: debt.toLocaleString(localeTag) }),
            })}
          >
            <PlateDebt amount={formatMoney(debt)} label={t("patientChart.plate.debt")} />
          </button>
        )}
        {/* Everything that is not part of the session: one quiet button. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-14 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:outline-white",
            )}
            aria-label={t("patientChart.moreActions")}
          >
            <Ellipsis className="size-6" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-56 p-2">
            <DropdownMenuItem onClick={handleIssueInvoice} className="min-h-11 gap-2.5 text-[17px]">
              <Receipt className="size-5" aria-hidden />
              {t("patientChart.issueInvoice")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openScheduleNext} className="min-h-11 gap-2.5 text-[17px]">
              <Calendar className="size-5" aria-hidden />
              {t("patientChart.scheduleNext")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExportOpen(true)} className="min-h-11 gap-2.5 text-[17px]">
              <Download className="size-5" aria-hidden />
              {t("export.patientRecord")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="lg"
          onClick={() => setCloseOpen(true)}
          className="hidden h-14 px-6 focus-visible:outline-white md:inline-flex"
          aria-label={t("patientChart.completeSessionAria")}
        >
          {t("patientChart.close.confirm")}
        </Button>
      </PagePlate>

      <div className="space-y-5 pb-40 md:pb-8">
        {/* Phone only: the bottom bar with Close session. From tablet up the
            plate carries both the close and the "…" menu. */}
        <PatientActionBar
          outstandingDebt={debt}
          onCompleteSession={() => setCloseOpen(true)}
          onIssueInvoice={handleIssueInvoice}
          patientId={id}
          patientName={displayPatient.fullName}
          lastAppointmentType={patientLastAppointmentType}
          nextSessionNumber={currentSession}
        />

        <PatientSmartHeader
          patient={displayPatient}
          overrides={contactOverrides}
          totalSessionsDone={totalSessionsDone}
          planTarget={planTarget}
          planIsPersonal={planIsPersonal}
          onPlanTargetChange={setPlanTarget}
          clinicalStatus={clinicalStatus}
          onClinicalStatusChange={setClinicalStatus}
          onStatusChange={live ? setPatientStatus : undefined}
          onSaveOverrides={saveContactOverrides}
          lastVisit={lastVisit}
          bodyMarks={bodyMarks}
          bodyMarks3d={bodyMarks3d}
          onAddBodyMark={addBodyMark}
          onUpdateBodyMarkNote={updateBodyMarkNote}
          onUpdateBodyMarkTones={updateBodyMarkTones}
          onRemoveBodyMark={removeBodyMark}
          part="brief"
        />

        {/* The sheet and the file, side by side from a tablet held sideways:
            what is being written beside what was written before. Upright, the
            file goes under the sheet. */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/*
            Written on with a pen, on a tablet, with a hand resting on the card.
            The canvas blocks the tablet's long-press menu itself, but a palm
            landing an inch off it — on the heading, the progress counter, the
            notes label — selected that text and raised "Look Up / Translate"
            over the drawing. Selection is off for the whole card and switched
            back on only in the notes field, where it is the point.
          */}
          <section
            id="active-session"
            aria-labelledby="session-heading"
            className="min-w-0 scroll-mt-24 select-none [-webkit-touch-callout:none]"
          >
            <div className="overflow-hidden rounded-md border border-hair bg-paper">
              <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b border-hair-soft px-4 py-2">
                <h2 id="session-heading" className="text-[17px] font-bold text-ink">
                  {t("patientChart.activeSession")}
                </h2>
                <span className="inline-flex items-center gap-1.5 text-sm text-mute">
                  <StateMark state="now" />
                  {t("patientChart.live")}
                </span>
                <span className="ms-auto text-sm tabular-nums text-mute">
                  {pastPlan
                    ? t("patientChart.sessionPastPlan", {
                        current: currentSession,
                        total: planTarget,
                      })
                    : t("patientChart.sessionProgress", {
                        current: currentSession,
                        total: planTarget,
                      })}
                </span>
              </div>

              <div className="space-y-3 p-4">
                {/* Above the drawing, not below it. Below, it sat exactly where
                    a writing wrist rests on a tablet: the wrist pressed Record,
                    the microphone prompt took the screen mid-word, and the
                    letter being written was lost. */}
                <SessionAudio
                  audioUrl={sessionAudioUrl}
                  onRecorded={saveSessionAudio}
                  onDelete={clearSessionAudio}
                />

                <SessionCanvas
                  key={id}
                  initialStrokes={canvasStrokes}
                  onStrokesChange={setCanvasStrokes}
                />

                <SessionSpine selected={sessionSpine} onToggle={toggleSessionSpine} />

                <div className="rounded-md border border-hair">
                  <button
                    type="button"
                    onClick={() => setNotesOpen((v) => !v)}
                    className="flex min-h-12 w-full items-center gap-2 px-4 text-start text-[17px] font-bold text-ink transition-colors hover:bg-ground"
                    aria-expanded={notesOpen}
                    aria-controls="session-notes-panel"
                  >
                    <StickyNote className="size-5 text-mute" aria-hidden />
                    {t("patientChart.sessionNotes")}
                    {notesOpen ? (
                      <ChevronUp className="ms-auto size-5 text-mute" aria-hidden />
                    ) : (
                      <ChevronDown className="ms-auto size-5 text-mute" aria-hidden />
                    )}
                  </button>

                  <div
                    id="session-notes-panel"
                    className={cn(
                      "overflow-hidden transition-all duration-300",
                      notesOpen ? "max-h-[400px]" : "max-h-0",
                    )}
                  >
                    <div className="border-t border-hair-soft p-3">
                      <textarea
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder={t("patientChart.sessionNotesPh")}
                        rows={5}
                        className="w-full resize-none rounded-md border border-hair bg-paper px-3 py-2.5 text-[17px] leading-relaxed text-ink outline-none select-text placeholder:text-faint focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt [-webkit-touch-callout:default]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            aria-label={t("patientChart.timelineTitle")}
            className="min-w-0 overflow-hidden rounded-md border border-hair bg-paper lg:sticky lg:top-4"
          >
            <Tabs defaultValue="history" className="gap-0">
              <div className="border-b border-hair px-3">
                <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-x-3 pb-0">
                  <TabsTrigger value="history" className="min-h-14 px-1">
                    {t("patientChart.tab.history")}
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="min-h-14 px-1">
                    {t("patientChart.tab.documents")}
                    {documentRecords.length > 0 && (
                      <span className="text-sm font-medium tabular-nums text-mute">
                        {documentRecords.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="map" className="min-h-14 px-1">
                    {t("patientChart.tab.bodyMap")}
                  </TabsTrigger>
                  <TabsTrigger value="details" className="min-h-14 px-1">
                    {t("patientChart.tab.details")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="history">
                <UnifiedTimeline
                  treatmentRecords={treatmentRecords}
                  documentRecords={documentRecords}
                  financeRecords={financeRecords}
                  completedSessions={completedSessions}
                  planTarget={planTarget}
                  treatmentsAreLive={treatmentsAreLive}
                  onDeleteTreatment={deleteTreatmentRecord}
                  onDeleteCompletedSession={deleteCompletedSession}
                  onVoidTreatment={live ? voidTreatmentRecord : undefined}
                />
                <div className="border-t border-hair-soft px-5 py-3">
                  <StateLegend
                    items={[
                      { state: "done", label: t("appt.status.completed") },
                      { state: "plan", label: t("appt.status.scheduled") },
                      { state: "cancel", label: t("appt.status.cancelled") },
                    ]}
                  />
                </div>
              </TabsContent>

              <TabsContent value="documents">
                {/* One library, in the file column on every width. It used to
                    sit in a sidebar that only existed on a desktop, so a tablet
                    in the treatment room could not see a single document. */}
                <PatientLibrary
                  documentRecords={documentRecords}
                  onDeleteDocument={deleteDocumentRecord}
                  onUploadDocument={live ? uploadDocumentRecord : undefined}
                />
              </TabsContent>

              <TabsContent value="map">
                {/* The marks in words here; the map itself opens full size. It
                    was tuned at a tablet's full width, and in this column the
                    figures would be too small to aim at. */}
                <div className="grid gap-3 px-5 py-4">
                  <p className="text-[17px] leading-snug text-mute">
                    {bodyMarks.length === 0
                      ? t("patientChart.brief.noMarks")
                      : t("bodyMap.count", {
                          n: bodyMarks.reduce((n, m) => n + m.regions.length + m.vertebrae.length, 0),
                        })}
                  </p>
                  <Button variant="outline" onClick={() => setMapOpen(true)} className="justify-self-start">
                    {t("patientChart.bodyMapOpen")}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="details">
                <PatientSmartHeader
                  patient={displayPatient}
                  overrides={contactOverrides}
                  totalSessionsDone={totalSessionsDone}
                  planTarget={planTarget}
                  planIsPersonal={planIsPersonal}
                  onPlanTargetChange={setPlanTarget}
                  clinicalStatus={clinicalStatus}
                  onClinicalStatusChange={setClinicalStatus}
                  onStatusChange={live ? setPatientStatus : undefined}
                  onSaveOverrides={saveContactOverrides}
                  lastVisit={lastVisit}
                  bodyMarks={bodyMarks}
                  bodyMarks3d={bodyMarks3d}
                  onAddBodyMark={addBodyMark}
                  onUpdateBodyMarkNote={updateBodyMarkNote}
                  onUpdateBodyMarkTones={updateBodyMarkTones}
                  onRemoveBodyMark={removeBodyMark}
                  part="details"
                />
                <div className="border-t border-hair-soft p-4">
                  <GeneralNotesCard
                    initialValue={contactOverrides.generalNotes ?? displayPatient.generalNotes ?? ""}
                    onSave={(v) => saveContactOverrides({ ...contactOverrides, generalNotes: v })}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>

      {/* The body map, full size. Closing the sheet unmounts the map, which
          saves a mark still being drawn — as collapsing its panel always did. */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-h-[94dvh] w-[min(1200px,96vw)] overflow-y-auto sm:max-w-none">
          <DialogTitle>{t("patientChart.bodyMapTitle")}</DialogTitle>
          {mapOpen && (
            <PatientSmartHeader
              patient={displayPatient}
              overrides={contactOverrides}
              totalSessionsDone={totalSessionsDone}
              planTarget={planTarget}
              planIsPersonal={planIsPersonal}
              onPlanTargetChange={setPlanTarget}
              clinicalStatus={clinicalStatus}
              onClinicalStatusChange={setClinicalStatus}
              onStatusChange={live ? setPatientStatus : undefined}
              onSaveOverrides={saveContactOverrides}
              lastVisit={lastVisit}
              bodyMarks={bodyMarks}
              bodyMarks3d={bodyMarks3d}
              onAddBodyMark={addBodyMark}
              onUpdateBodyMarkNote={updateBodyMarkNote}
              onUpdateBodyMarkTones={updateBodyMarkTones}
              onRemoveBodyMark={removeBodyMark}
              part="map"
            />
          )}
        </DialogContent>
      </Dialog>

      <SessionCloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        sessionNumber={totalSessionsDone + 1}
        patientName={displayPatient.fullName}
        contents={{
          drawing: canvasStrokes.length > 0,
          notes: !!sessionNotes.trim(),
          audio: !!sessionAudioUrl,
        }}
        nextAppointment={nextAppointment}
        defaultAmount={
          getTreatmentPriceIls(
            todaysAppointment?.appointmentType ?? patientLastAppointmentType,
          ) ?? 0
        }
        outstandingDebt={outstandingDebt ?? 0}
        onScheduleNext={() => {
          // Booking instead of sending a link closes this sheet: the diary is
          // about to change, and the sheet's answer to "is anything booked"
          // was read before it did.
          setCloseOpen(false)
          openScheduleNext()
        }}
        onConfirm={handleCloseSession}
        sessionIsEmpty={
          !sessionNotes.trim() &&
          canvasStrokes.length === 0 &&
          !sessionAudioUrl &&
          sessionSpine.length === 0
        }
        lastRecordedAt={
          treatmentRecords
            .filter((r) => !r.voidedAt)
            .map((r) => r.recordedAt)
            .sort()
            .at(-1) ?? null
        }
      />

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
          className="fixed end-6 bottom-6 z-[100] flex max-w-sm items-start gap-3 rounded-md border-2 border-signal bg-paper py-3 ps-4 pe-2"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
          <div className="min-w-0">
            <p className="text-[17px] leading-snug font-medium text-ink">
              {t("patientChart.saveFailed")}
            </p>
            {/* What the database actually said. Without it, "check your
                connection" was the only clue anyone had for twelve days while
                the real answer — an ambiguous relationship — was in the
                response all along. It is jargon, and it is meant to be
                repeated verbatim to whoever fixes it. */}
            <p className="mt-1 font-mono text-[13px] leading-snug break-words text-mute">
              {saveError}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearSaveError}
            className="shrink-0 text-mute"
            aria-label={t("common.cancel")}
          >
            <X className="size-5" aria-hidden />
          </Button>
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
    <section
      aria-labelledby="general-notes-heading"
      className="overflow-hidden rounded-md border border-hair bg-paper"
    >
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-hair-soft px-5 py-1.5">
        <h2 id="general-notes-heading" className="text-[17px] font-bold text-ink">
          {t("patientChart.generalNotes")}
        </h2>
        {!editing ? (
          <Button
            variant="outline"
            onClick={enterEdit}
            className="text-sm"
            aria-label={t("patientChart.editGeneralNotesAria")}
          >
            <Pencil aria-hidden />
            {t("common.edit")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={cancel} className="text-sm">
              <X aria-hidden />
              {t("common.cancel")}
            </Button>
            <Button variant="outline" onClick={save} className="border-cobalt text-sm">
              <Check aria-hidden />
              {t("common.save")}
            </Button>
          </div>
        )}
      </div>
      <div className="px-5 py-4">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-md border border-hair bg-paper px-3 py-2.5 text-[17px] leading-relaxed text-ink outline-none placeholder:text-faint focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
            placeholder={t("patientChart.generalNotesPh")}
          />
        ) : (
          <p dir="auto" className="text-[17px] leading-relaxed text-ink">
            {initialValue || (
              <span className="text-faint italic">{t("patientChart.noGeneralNotes")}</span>
            )}
          </p>
        )}
      </div>
    </section>
  )
}
