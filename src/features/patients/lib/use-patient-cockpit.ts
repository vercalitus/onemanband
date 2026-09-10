"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { usePatientExtras } from "@/components/providers/patient-extras-provider"
import { createTranslator } from "@/lib/i18n/dictionary"
import {
  localizeDocumentRecord,
  localizeFinanceRecord,
  localizeTreatmentRecord,
} from "@/lib/i18n/localized-seed"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { treatmentsByPatient, documentsByPatient, financesByPatient } from "@/lib/mock-data"
import type {
  AppointmentType,
  TreatmentRecord,
  DocumentRecord,
  DocumentType,
  FinanceRecord,
  PatientStatus,
  TreatmentMark,
  BodyMapView,
} from "@/types/domain"
import {
  renderStrokesToBlob,
  renderStrokesToDataUrl,
  type Stroke,
} from "@/features/patients/lib/canvas-strokes"
import {
  deleteDocument,
  fetchPatientDocuments,
  uploadDocument,
} from "@/features/patients/lib/document-repository"
import { updatePatient } from "@/features/patients/lib/patient-repository"
import {
  createTreatment,
  fetchPatientTreatments,
  voidTreatment,
} from "@/features/patients/lib/treatment-repository"
import {
  fetchInvoices,
  fetchPatientOutstanding,
} from "@/features/finances/lib/finance-repository"
import {
  PATIENT_EXTRAS_EVENT,
  readAddedFinances,
  readAddedTreatments,
  readField,
  writeField,
} from "@/features/patients/lib/patient-extras-store"
import { deleteAudio, getAudio, moveAudio, putAudio } from "@/lib/audio-store"

/**
 * The patient chart's state.
 *
 * There are two modes and the difference matters. When the clinic has real
 * patients, everything a practitioner writes here goes to Postgres: the status
 * line, the contact details, the notes, the marks on the body diagram, and the
 * session itself. When there is no database — an unconfigured deploy showing
 * the demo — the old browser-local behaviour stays, so the demo still works.
 *
 * It used to be browser-local in both cases, which was the single largest
 * problem with this page: a chart read differently on the clinic machine and on
 * a phone, clearing site data destroyed clinical notes with no backup, and a
 * phone number corrected here never reached the reminder engine.
 *
 * In-progress session state — the strokes still on the canvas, the memo still
 * recording, the note being typed — deliberately stays local in both modes.
 * That is a draft, and a draft belongs to the machine it is being written on
 * until the session is closed.
 */

export interface CompletedSession {
  id: string
  completedAt: string
  /** e.g. localized "Session 3 of 10 — Adjustments" or Hebrew equivalent */
  title: string
  sessionNotes: string
  /** Immutable PNG snapshot of the handwriting, rasterized at completion. */
  canvasDataUrl: string | null
  /** IndexedDB key of the attached voice memo, if any. */
  audioKey?: string | null
}

const activeAudioKey = (patientId: string) => `audio-active:${patientId}`
const sessionAudioKey = (sessionId: string) => `audio-session:${sessionId}`

export interface PatientContactOverrides {
  phone?: string
  email?: string
  address?: string
  medicalHistorySummary?: string
  generalNotes?: string
}

/**
 * The one-line status shown at the top of the chart, and where it came from.
 *
 * The source travels with the text because the two are not interchangeable to a
 * reader: "the practitioner wrote this on 3 March" and "this is what happened
 * at the last visit" carry different weight, and a line with no origin at all
 * is what this field used to be.
 */
export interface ClinicalStatus {
  text: string
  source: "manual" | "treatment" | "none"
  /** The instant the text is dated to. Null when there is nothing to date. */
  at: string | null
  /**
   * What the practitioner actually wrote, which is empty while the line is
   * being borrowed from the last visit. The editor opens on this rather than on
   * the displayed text: otherwise one click and Enter would silently freeze a
   * line that was tracking the record into a copy that no longer does.
   */
  manualText: string
}

/**
 * The sentence the demo shipped with, in the three languages it was written in.
 *
 * It was never data. It was hard-coded, so every patient in the clinic — all
 * 1,178 of them — displayed the same sentence in the place a reader looks for a
 * clinical finding about the person in front of them. It is listed here only so
 * that a copy which reached a browser (one press of Enter on the status field
 * saved it) is treated as blank instead of being shown again.
 */
const DEMO_STATUS_SENTENCES = [
  "Gradual improvement in cervical range of motion, focus on workplace posture",
  "שיפור הדרגתי בטווח התנועה הצווארית; דגש על יציבה במקום העבודה",
  "شيء تدريجي في مدى حركة الرقبة؛ التركيز على وضعية الجسم في مكان العمل",
  "تحسّن تدريجي في مدى حركة الرقبة؛ التركيز على وضعية الجسم في مكان العمل",
  "שיפור הדרגתי בטווח תנועה צווארי, דגש על יציבה בעבודה",
]

/**
 * Ask the server to read the handwriting. Null when it cannot — no key on the
 * deploy, a network fault, an empty result — and the session closes without a
 * transcription rather than without a record.
 */
async function transcribeHandwriting(canvas: Blob): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await canvas.arrayBuffer())
    let binary = ""
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    const res = await fetch("/api/treatments/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: btoa(binary) }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; text?: string }
    const text = body.ok ? (body.text ?? "").trim() : ""
    return text || null
  } catch {
    return null
  }
}

const cleanStoredStatus = (raw: string | null | undefined): string => {
  const text = (raw ?? "").trim()
  return DEMO_STATUS_SENTENCES.includes(text) ? "" : text
}

export function usePatientCockpit(patientId: string) {
  const { t, locale, formatMoney } = useLocale()
  const { live, replaceLivePatient } = usePatientExtras()

  /**
   * The patient's own row, when this clinic has real records. Its presence is
   * what decides where every write below goes — the same rule the rest of the
   * app uses, and no flag anyone has to remember to set.
   */
  const livePatient = useMemo(
    () => live?.find((entry) => entry.id === patientId) ?? null,
    [live, patientId],
  )
  const isLive = !!livePatient

  const [manualStatus, setManualStatus] = useState<{ text: string; at: string | null }>({
    text: "",
    at: null,
  })
  const [sessionNotes, setSessionNotesRaw] = useState("")
  const [canvasStrokes, setCanvasStrokesRaw] = useState<Stroke[]>([])
  const [sessionAudioUrl, setSessionAudioUrl] = useState<string | null>(null)
  const [completedSessions, setCompletedSessionsRaw] = useState<CompletedSession[]>([])
  const [deletedTreatmentIds, setDeletedTreatmentIds] = useState<string[]>([])
  const [deletedDocumentIds, setDeletedDocumentIds] = useState<string[]>([])
  const [contactOverrides, setContactOverridesRaw] = useState<PatientContactOverrides>({})
  const [lastAppointmentType, setLastAppointmentTypeRaw] = useState<AppointmentType>("adjustments")
  const [treatmentMarks, setTreatmentMarksRaw] = useState<TreatmentMark[]>([])
  const [hydrated, setHydrated] = useState(false)
  /** Why the last write did not stick. Silence here would be the old bug back. */
  const [saveError, setSaveError] = useState<string | null>(null)

  // Track the current active-audio object URL so we can revoke it on change.
  const audioUrlRef = useRef<string | null>(null)
  const applyAudioUrl = useCallback((url: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = url
    setSessionAudioUrl(url)
  }, [])

  /**
   * Seed the editable fields once per patient.
   *
   * Once, rather than on every change to the cached patient list: after a save
   * this hook already holds the newer value, and re-seeding from a list that
   * has not caught up would overwrite what was just typed.
   */
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    const key = `${patientId}:${isLive ? "live" : "local"}`
    if (seededFor.current === key) return
    seededFor.current = key

    if (isLive && livePatient) {
      setManualStatus({
        text: cleanStoredStatus(livePatient.clinicalStatus),
        at: livePatient.clinicalStatusUpdatedAt ?? null,
      })
      setTreatmentMarksRaw(livePatient.bodyMapMarks ?? [])
      // The row itself carries the contact details; an overlay on top of it
      // would be a second copy that can disagree with the record.
      setContactOverridesRaw({})
    } else {
      setManualStatus({
        text: cleanStoredStatus(readField<string | null>(patientId, "clinicalStatus", null)),
        at: null,
      })
      setTreatmentMarksRaw(readField<TreatmentMark[]>(patientId, "treatmentMarks", []))
      setContactOverridesRaw(readField(patientId, "contactOverrides", {}))
    }

    // Session drafts and legacy local sessions are browser-local in both modes.
    setSessionNotesRaw(readField(patientId, "sessionNotes", ""))
    setCanvasStrokesRaw(readField<Stroke[]>(patientId, "canvasStrokes", []))
    setCompletedSessionsRaw(readField(patientId, "completedSessions", []))
    setDeletedTreatmentIds(readField(patientId, "deletedTreatmentIds", []))
    setDeletedDocumentIds(readField(patientId, "deletedDocumentIds", []))
    setLastAppointmentTypeRaw(readField(patientId, "lastAppointmentType", "adjustments"))
    setHydrated(true)
  }, [patientId, isLive, livePatient])

  // Restore an in-progress voice memo for this patient (stored in IndexedDB).
  useEffect(() => {
    let cancelled = false
    getAudio(activeAudioKey(patientId)).then((blob) => {
      if (cancelled) return
      applyAudioUrl(blob ? URL.createObjectURL(blob) : null)
    })
    return () => {
      cancelled = true
      applyAudioUrl(null)
    }
  }, [patientId, applyAudioUrl])

  /** One place where a patient-row write lands, so none of them can be silent. */
  const savePatientFields = useCallback(
    async (patch: Parameters<typeof updatePatient>[1]): Promise<boolean> => {
      const written = await updatePatient(patientId, patch)
      if (written.ok) {
        replaceLivePatient(written.patient)
        return true
      }
      setSaveError(written.reason)
      return false
    },
    [patientId, replaceLivePatient],
  )

  const setClinicalStatus = useCallback(
    (value: string) => {
      const text = value.trim()
      // The editor commits on blur, so opening it and clicking away is a
      // commit. Writing the same text again would re-stamp the date, and the
      // chart would then claim the status was written today when nobody wrote
      // anything — the date is part of what the line means.
      if (text === manualStatus.text) return
      const at = text ? new Date().toISOString() : null
      setManualStatus({ text, at })
      if (isLive) {
        void savePatientFields({ clinicalStatus: text })
        return
      }
      writeField(patientId, "clinicalStatus", text)
    },
    [patientId, isLive, savePatientFields, manualStatus.text],
  )

  /**
   * Active, frozen or past. The list filters on it and the badge shows it, but
   * until now nothing on the chart could change it — a patient who moved away
   * stayed "active" forever, because the only place the status was ever set
   * was the moment they were created.
   */
  const setPatientStatus = useCallback(
    (status: PatientStatus) => {
      if (!isLive || !livePatient || livePatient.status === status) return
      void savePatientFields({ status })
    },
    [isLive, livePatient, savePatientFields],
  )

  const setSessionNotes = useCallback(
    (value: string) => {
      setSessionNotesRaw(value)
      writeField(patientId, "sessionNotes", value)
    },
    [patientId],
  )

  const setCanvasStrokes = useCallback(
    (value: Stroke[]) => {
      setCanvasStrokesRaw(value)
      writeField(patientId, "canvasStrokes", value)
    },
    [patientId],
  )

  const saveSessionAudio = useCallback(
    async (blob: Blob) => {
      await putAudio(activeAudioKey(patientId), blob)
      applyAudioUrl(URL.createObjectURL(blob))
    },
    [patientId, applyAudioUrl],
  )

  const clearSessionAudio = useCallback(async () => {
    await deleteAudio(activeAudioKey(patientId))
    applyAudioUrl(null)
  }, [patientId, applyAudioUrl])

  const saveContactOverrides = useCallback(
    (overrides: PatientContactOverrides) => {
      if (isLive) {
        // Shown immediately, then written. The row that comes back replaces the
        // cached one, so the list and the chart never disagree.
        setContactOverridesRaw(overrides)
        void savePatientFields({
          phone: overrides.phone,
          email: overrides.email,
          address: overrides.address,
          medicalHistorySummary: overrides.medicalHistorySummary,
          generalNotes: overrides.generalNotes,
        }).then((ok) => {
          // The saved row now carries these values, so the overlay has nothing
          // left to say. Keeping it would shadow any later change to the row.
          if (ok) setContactOverridesRaw({})
        })
        return
      }
      setContactOverridesRaw(overrides)
      writeField(patientId, "contactOverrides", overrides)
    },
    [patientId, isLive, savePatientFields],
  )

  const setLastAppointmentType = useCallback(
    (type: AppointmentType) => {
      setLastAppointmentTypeRaw(type)
      writeField(patientId, "lastAppointmentType", type)
    },
    [patientId],
  )

  const persistMarks = useCallback(
    (next: TreatmentMark[]) => {
      setTreatmentMarksRaw(next)
      if (isLive) {
        void savePatientFields({ bodyMapMarks: next })
        return
      }
      writeField(patientId, "treatmentMarks", next)
    },
    [patientId, isLive, savePatientFields],
  )

  const addTreatmentMark = useCallback(
    (view: BodyMapView, x: number, y: number) => {
      persistMarks([
        ...treatmentMarks,
        { id: `tm-${Date.now()}`, view, x, y, createdAt: new Date().toISOString() },
      ])
    },
    [treatmentMarks, persistMarks],
  )

  const updateTreatmentMarkNote = useCallback(
    (id: string, note: string) => {
      persistMarks(treatmentMarks.map((m) => (m.id === id ? { ...m, note } : m)))
    },
    [treatmentMarks, persistMarks],
  )

  const removeTreatmentMark = useCallback(
    (id: string) => {
      persistMarks(treatmentMarks.filter((m) => m.id !== id))
    },
    [treatmentMarks, persistMarks],
  )

  /**
   * Overlay records filed by automations (e.g. a returned progress
   * questionnaire). Kept in state and refreshed on the store event so a
   * questionnaire arriving while the chart is open shows up without a reload.
   */
  const [addedTreatments, setAddedTreatments] = useState<TreatmentRecord[]>([])
  const [addedFinances, setAddedFinances] = useState<FinanceRecord[]>([])

  useEffect(() => {
    const sync = () => {
      setAddedTreatments(readAddedTreatments(patientId))
      setAddedFinances(readAddedFinances(patientId))
    }
    sync()
    window.addEventListener(PATIENT_EXTRAS_EVENT, sync)
    return () => window.removeEventListener(PATIENT_EXTRAS_EVENT, sync)
  }, [patientId])

  /**
   * The patient's real treatment history. Null while unknown or unavailable,
   * which is what keeps the demo dataset on screen for a deploy with no
   * database and stops a failed request from emptying somebody's chart.
   */
  const [liveTreatments, setLiveTreatments] = useState<TreatmentRecord[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchPatientTreatments(patientId).then((rows) => {
      if (!cancelled) setLiveTreatments(rows)
    })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const treatmentRecords: TreatmentRecord[] = useMemo(() => {
    // A saved record is never localised: it is what was written at the visit.
    const base = liveTreatments ?? (treatmentsByPatient[patientId] ?? []).map((r) =>
      localizeTreatmentRecord(r, locale),
    )
    return [...addedTreatments.map((r) => localizeTreatmentRecord(r, locale)), ...base]
      .filter((r) => !deletedTreatmentIds.includes(r.id))
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
  }, [patientId, liveTreatments, addedTreatments, deletedTreatmentIds, locale])

  /** True once the history is coming from Postgres, where a record cannot be unwritten. */
  const treatmentsAreLive = liveTreatments !== null

  /**
   * Mark a saved session as saved in error. The row stays; it stops counting.
   * Only for the clinic's own records — a demo row is simply deleted.
   */
  const voidTreatmentRecord = useCallback(
    async (id: string, reason: string): Promise<boolean> => {
      const result = await voidTreatment(id, reason)
      if (!result.ok) {
        setSaveError(result.reason)
        return false
      }
      const at = new Date().toISOString()
      setLiveTreatments((prev) =>
        prev ? prev.map((r) => (r.id === id ? { ...r, voidedAt: at, voidReason: reason } : r)) : prev,
      )
      return true
    },
    [],
  )

  const clinicalStatus: ClinicalStatus = useMemo(() => {
    if (manualStatus.text) {
      return {
        text: manualStatus.text,
        source: "manual",
        at: manualStatus.at,
        manualText: manualStatus.text,
      }
    }
    // A record saved in error says nothing about the patient.
    const latest = treatmentRecords.find((r) => !r.voidedAt)
    const fromVisit = latest?.note?.trim() || latest?.title?.trim()
    if (latest && fromVisit) {
      return { text: fromVisit, source: "treatment", at: latest.recordedAt, manualText: "" }
    }
    return { text: "", source: "none", at: null, manualText: "" }
  }, [manualStatus, treatmentRecords])

  /**
   * The patient's real documents, when this clinic has any.
   *
   * Null while unknown or unavailable, which is what keeps the demo dataset on
   * screen for a deploy with no database — and what stops a failed request from
   * making a patient's file look empty.
   */
  const [liveDocuments, setLiveDocuments] = useState<DocumentRecord[] | null>(null)
  const reloadDocuments = useCallback(() => {
    void fetchPatientDocuments(patientId).then(setLiveDocuments)
  }, [patientId])

  useEffect(() => {
    let cancelled = false
    void fetchPatientDocuments(patientId).then((docs) => {
      if (!cancelled) setLiveDocuments(docs)
    })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const documentRecords: DocumentRecord[] = useMemo(() => {
    // A real record is never localised: its name is the file's name.
    if (liveDocuments) {
      return liveDocuments.filter((r) => !deletedDocumentIds.includes(r.id))
    }
    const all = documentsByPatient[patientId] ?? []
    return all
      .filter((r) => !deletedDocumentIds.includes(r.id))
      .map((r) => localizeDocumentRecord(r, locale))
  }, [patientId, deletedDocumentIds, locale, liveDocuments])

  /**
   * This patient's invoices, from the ledger.
   *
   * The chart used to read the demo file here, so a real invoice — issued from
   * this very app, against this very patient — never appeared anywhere on their
   * record. Null while unknown, which keeps the demo rows on screen for a
   * deploy with no database.
   */
  const [liveInvoices, setLiveInvoices] = useState<FinanceRecord[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchInvoices(formatMoney).then((result) => {
      if (cancelled || result.source !== "live") return
      setLiveInvoices(
        result.invoices
          .filter((invoice) => invoice.patientId === patientId)
          .map((invoice) => ({
            id: invoice.id,
            issuedAt: invoice.issuedAt ?? invoice.dueAt ?? "",
            description: t(`billing.treatment.${invoice.treatmentType}`),
            amount: invoice.displayAmount,
            invoiceStatus: invoice.status,
            paymentStatus: invoice.paymentStatus,
          })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [patientId, formatMoney, t])

  const financeRecords: FinanceRecord[] = useMemo(() => {
    if (liveInvoices) return liveInvoices
    // Auto-issued invoices first — they are the most recent by construction.
    const all = [...addedFinances, ...(financesByPatient[patientId] ?? [])]
    return all.map((r) => localizeFinanceRecord(r, locale))
  }, [patientId, addedFinances, locale, liveInvoices])

  /**
   * What this patient still owes, from the ledger rather than from the demo
   * figures. Null while unknown — a chart that cannot reach the ledger must not
   * claim the account is clear.
   */
  const [outstandingDebt, setOutstandingDebt] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchPatientOutstanding(patientId).then((amount) => {
      if (!cancelled) setOutstandingDebt(amount)
    })
    return () => {
      cancelled = true
    }
  }, [patientId])

  /**
   * How many sessions this patient's course runs to.
   *
   * Their own plan when one has been agreed; the practice default otherwise.
   * The chart used to show the default for everybody, so the progress bar
   * measured real visits against a target nobody had prescribed for the person
   * whose chart it was.
   */
  const clinicDefaultPlan = useMemo(() => {
    try {
      return readClinicSettings().defaultPlanSessions ?? 10
    } catch {
      return 10
    }
  }, [])
  const planTarget = livePatient?.carePlanSessions ?? clinicDefaultPlan
  /** True when the number on screen is this patient's, not the practice-wide one. */
  const planIsPersonal = livePatient?.carePlanSessions !== undefined

  const setPlanTarget = useCallback(
    (sessions: number | null) => {
      if (!isLive) return
      // Enter commits and then the blur commits again; the second one is a
      // no-op and should cost nothing.
      if (sessions === (livePatient?.carePlanSessions ?? null)) return
      void savePatientFields({ carePlanSessions: sessions })
    },
    [isLive, livePatient?.carePlanSessions, savePatientFields],
  )

  const totalSessionsDone =
    treatmentRecords.filter((r) => !r.voidedAt).length + completedSessions.length

  /**
   * Close the session and write it down.
   *
   * Live: a row in `treatments`, with the handwriting and the voice memo
   * uploaded to the patient's private folder. That row cannot afterwards be
   * edited or deleted — the database refuses both — which is what makes it a
   * record rather than a note.
   *
   * The title is stored in English rather than in whatever language the app
   * happened to be in. A clinical record that reads differently depending on
   * who opens it is the same mistake the tax documents made.
   */
  const completeSession = useCallback(
    async (appointmentType: AppointmentType = "adjustments"): Promise<boolean> => {
      const sessionNumber = totalSessionsDone + 1

      if (isLive) {
        const canvas = await renderStrokesToBlob(canvasStrokes)
        const audio = await getAudio(activeAudioKey(patientId))
        // What the pen wrote, as text. The handwriting stays as the image;
        // the transcription goes into the note, labelled as a machine's
        // reading of it, so the record can be searched and read at a glance
        // without anyone pretending the transcription is the original.
        const transcript = canvas ? await transcribeHandwriting(canvas) : null
        const note = transcript
          ? `${sessionNotes.trim()}${sessionNotes.trim() ? "\n\n" : ""}— Handwriting, transcribed automatically —\n${transcript}`
          : sessionNotes
        const written = await createTreatment(patientId, {
          title: createTranslator("en")(`billing.treatment.${appointmentType}`),
          note,
          treatmentType: appointmentType,
          canvas,
          audio,
        })
        if (!written.ok) {
          setSaveError(written.reason)
          return false
        }
        setLiveTreatments((prev) => [written.treatment, ...(prev ?? [])])
        await deleteAudio(activeAudioKey(patientId))
        setLastAppointmentType(appointmentType)
        setSessionNotes("")
        setCanvasStrokes([])
        applyAudioUrl(null)
        return true
      }

      const typeLabel = t(`billing.treatment.${appointmentType}`)
      const title = t("patientChart.sessionCompleteTitle", {
        n: sessionNumber,
        total: planTarget,
        type: typeLabel,
      })

      const sessionId = `cs-${Date.now()}`
      // Rasterize the vector strokes into an immutable snapshot for the summary.
      const canvasDataUrl = renderStrokesToDataUrl(canvasStrokes)
      // Promote the in-progress voice memo to a permanent, session-scoped key.
      const audioKey = await moveAudio(activeAudioKey(patientId), sessionAudioKey(sessionId))

      const entry: CompletedSession = {
        id: sessionId,
        completedAt: new Date().toISOString(),
        title,
        sessionNotes,
        canvasDataUrl,
        audioKey,
      }
      setCompletedSessionsRaw((prev) => {
        const next = [entry, ...prev]
        writeField(patientId, "completedSessions", next)
        return next
      })
      setLastAppointmentType(appointmentType)
      setSessionNotes("")
      setCanvasStrokes([])
      applyAudioUrl(null)
      return true
    },
    [
      patientId,
      isLive,
      totalSessionsDone,
      planTarget,
      sessionNotes,
      canvasStrokes,
      setLastAppointmentType,
      setSessionNotes,
      setCanvasStrokes,
      applyAudioUrl,
      t,
    ],
  )

  const deleteTreatmentRecord = useCallback(
    (id: string) => {
      setDeletedTreatmentIds((prev) => {
        const next = [...prev, id]
        writeField(patientId, "deletedTreatmentIds", next)
        return next
      })
    },
    [patientId],
  )

  const deleteCompletedSession = useCallback(
    (id: string) => {
      setCompletedSessionsRaw((prev) => {
        const target = prev.find((s) => s.id === id)
        if (target?.audioKey) void deleteAudio(target.audioKey)
        const next = prev.filter((s) => s.id !== id)
        writeField(patientId, "completedSessions", next)
        return next
      })
    },
    [patientId],
  )

  /**
   * Remove a document for good, when it is a real one: the file leaves the
   * bucket and the row leaves the table.
   *
   * It used to add the id to a list in localStorage. The file stayed, the row
   * stayed, and the document reappeared on the next device — a bin that did not
   * empty, which is worse than no bin at all.
   */
  const deleteDocumentRecord = useCallback(
    async (id: string): Promise<boolean> => {
      if (liveDocuments) {
        const removed = await deleteDocument(id)
        if (!removed.ok) {
          setSaveError(removed.reason)
          return false
        }
        reloadDocuments()
        return true
      }
      setDeletedDocumentIds((prev) => {
        const next = [...prev, id]
        writeField(patientId, "deletedDocumentIds", next)
        return next
      })
      return true
    },
    [patientId, liveDocuments, reloadDocuments],
  )

  /**
   * Add a document to the chart. Only where the chart has a database: the demo
   * has nowhere to put a file, and pretending to accept one would be worse than
   * not offering.
   */
  const uploadDocumentRecord = useCallback(
    async (file: File, type: DocumentType): Promise<boolean> => {
      if (!liveDocuments) return false
      const written = await uploadDocument(patientId, file, type)
      if (!written.ok) {
        setSaveError(written.reason)
        return false
      }
      reloadDocuments()
      return true
    },
    [patientId, liveDocuments, reloadDocuments],
  )

  return {
    hydrated,
    live: isLive,
    saveError,
    clearSaveError: useCallback(() => setSaveError(null), []),
    clinicalStatus,
    setClinicalStatus,
    setPatientStatus,
    uploadDocumentRecord,
    voidTreatmentRecord,
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
    setLastAppointmentType,
    contactOverrides,
    saveContactOverrides,
    deleteDocumentRecord,
    treatmentMarks,
    addTreatmentMark,
    updateTreatmentMarkNote,
    removeTreatmentMark,
  }
}
