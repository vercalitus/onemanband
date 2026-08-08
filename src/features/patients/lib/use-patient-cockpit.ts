"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  localizeDocumentRecord,
  localizeFinanceRecord,
  localizeTreatmentRecord,
} from "@/lib/i18n/localized-seed"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { Locale } from "@/lib/i18n/types"
import { treatmentsByPatient, documentsByPatient, financesByPatient } from "@/lib/mock-data"
import type {
  AppointmentType,
  TreatmentRecord,
  DocumentRecord,
  FinanceRecord,
  TreatmentMark,
  BodyMapView,
} from "@/types/domain"
import { renderStrokesToDataUrl, type Stroke } from "@/features/patients/lib/canvas-strokes"
import { deleteAudio, getAudio, moveAudio, putAudio } from "@/lib/audio-store"

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

const DEFAULT_CLINICAL_EN =
  "Gradual improvement in cervical range of motion, focus on workplace posture"

const DEFAULT_CLINICAL_HE =
  "שיפור הדרגתי בטווח התנועה הצווארית; דגש על יציבה במקום העבודה"

const DEFAULT_CLINICAL_AR =
  "تحسّن تدريجي في مدى حركة الرقبة؛ التركيز على وضعية الجسم في مكان العمل"

const LEGACY_CLINICAL_STATUS_HE =
  "שיפור הדרגתי בטווח תנועה צווארי, דגש על יציבה בעבודה"

function defaultClinicalForLocale(locale: Locale): string {
  if (locale === "he") return DEFAULT_CLINICAL_HE
  if (locale === "ar") return DEFAULT_CLINICAL_AR
  return DEFAULT_CLINICAL_EN
}

/** Map stored defaults across locales without persisting until the user edits. */
function normalizeClinicalRead(stored: string | null | undefined, locale: Locale): string {
  const t = (stored ?? "").trim()
  const defaults = [DEFAULT_CLINICAL_EN, DEFAULT_CLINICAL_HE, DEFAULT_CLINICAL_AR, LEGACY_CLINICAL_STATUS_HE.trim()]
  if (t === "" || defaults.includes(t)) {
    return defaultClinicalForLocale(locale)
  }
  if (locale === "he" && t === DEFAULT_CLINICAL_EN) return DEFAULT_CLINICAL_HE
  if (locale === "he" && t === DEFAULT_CLINICAL_AR) return DEFAULT_CLINICAL_HE
  if (locale === "ar" && t === DEFAULT_CLINICAL_EN) return DEFAULT_CLINICAL_AR
  if (locale === "ar" && t === DEFAULT_CLINICAL_HE) return DEFAULT_CLINICAL_AR
  if (locale === "en" && t === DEFAULT_CLINICAL_HE) return DEFAULT_CLINICAL_EN
  if (locale === "en" && t === DEFAULT_CLINICAL_AR) return DEFAULT_CLINICAL_EN
  return stored ?? defaultClinicalForLocale(locale)
}

function storageKey(patientId: string, field: string) {
  return `patient.${patientId}.${field}`
}

function readField<T>(patientId: string, field: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey(patientId, field))
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeField(patientId: string, field: string, value: unknown) {
  try {
    window.localStorage.setItem(storageKey(patientId, field), JSON.stringify(value))
  } catch {}
}

export function usePatientCockpit(patientId: string) {
  const { t, locale } = useLocale()
  const [clinicalStatus, setClinicalStatusRaw] = useState(DEFAULT_CLINICAL_EN)
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

  // Track the current active-audio object URL so we can revoke it on change.
  const audioUrlRef = useRef<string | null>(null)
  const applyAudioUrl = useCallback((url: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = url
    setSessionAudioUrl(url)
  }, [])

  useEffect(() => {
    const rawClinical = readField<string | null>(patientId, "clinicalStatus", null)
    setClinicalStatusRaw(normalizeClinicalRead(rawClinical, locale))

    setSessionNotesRaw(readField(patientId, "sessionNotes", ""))
    setCanvasStrokesRaw(readField<Stroke[]>(patientId, "canvasStrokes", []))
    setCompletedSessionsRaw(readField(patientId, "completedSessions", []))
    setDeletedTreatmentIds(readField(patientId, "deletedTreatmentIds", []))
    setDeletedDocumentIds(readField(patientId, "deletedDocumentIds", []))
    setContactOverridesRaw(readField(patientId, "contactOverrides", {}))
    setLastAppointmentTypeRaw(readField(patientId, "lastAppointmentType", "adjustments"))
    setTreatmentMarksRaw(readField<TreatmentMark[]>(patientId, "treatmentMarks", []))
    setHydrated(true)

    // Restore an in-progress voice memo for this patient (stored in IndexedDB).
    let cancelled = false
    getAudio(activeAudioKey(patientId)).then((blob) => {
      if (cancelled) return
      applyAudioUrl(blob ? URL.createObjectURL(blob) : null)
    })
    return () => {
      cancelled = true
      applyAudioUrl(null)
    }
  }, [patientId, locale, applyAudioUrl])

  const setClinicalStatus = useCallback(
    (value: string) => {
      setClinicalStatusRaw(value)
      writeField(patientId, "clinicalStatus", value)
    },
    [patientId],
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
      setContactOverridesRaw(overrides)
      writeField(patientId, "contactOverrides", overrides)
    },
    [patientId],
  )

  const setLastAppointmentType = useCallback(
    (type: AppointmentType) => {
      setLastAppointmentTypeRaw(type)
      writeField(patientId, "lastAppointmentType", type)
    },
    [patientId],
  )

  const addTreatmentMark = useCallback(
    (view: BodyMapView, x: number, y: number) => {
      const mark: TreatmentMark = {
        id: `tm-${Date.now()}`,
        view,
        x,
        y,
        createdAt: new Date().toISOString(),
      }
      setTreatmentMarksRaw((prev) => {
        const next = [...prev, mark]
        writeField(patientId, "treatmentMarks", next)
        return next
      })
    },
    [patientId],
  )

  const updateTreatmentMarkNote = useCallback(
    (id: string, note: string) => {
      setTreatmentMarksRaw((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, note } : m))
        writeField(patientId, "treatmentMarks", next)
        return next
      })
    },
    [patientId],
  )

  const removeTreatmentMark = useCallback(
    (id: string) => {
      setTreatmentMarksRaw((prev) => {
        const next = prev.filter((m) => m.id !== id)
        writeField(patientId, "treatmentMarks", next)
        return next
      })
    },
    [patientId],
  )

  const treatmentRecords: TreatmentRecord[] = useMemo(() => {
    const all = treatmentsByPatient[patientId] ?? []
    return all
      .filter((r) => !deletedTreatmentIds.includes(r.id))
      .map((r) => localizeTreatmentRecord(r, locale))
  }, [patientId, deletedTreatmentIds, locale])

  const documentRecords: DocumentRecord[] = useMemo(() => {
    const all = documentsByPatient[patientId] ?? []
    return all
      .filter((r) => !deletedDocumentIds.includes(r.id))
      .map((r) => localizeDocumentRecord(r, locale))
  }, [patientId, deletedDocumentIds, locale])

  const financeRecords: FinanceRecord[] = useMemo(() => {
    const all = financesByPatient[patientId] ?? []
    return all.map((r) => localizeFinanceRecord(r, locale))
  }, [patientId, locale])

  const planTarget = useMemo(() => {
    try {
      return readClinicSettings().defaultPlanSessions ?? 10
    } catch {
      return 10
    }
  }, [])

  const totalSessionsDone = treatmentRecords.length + completedSessions.length

  const completeSession = useCallback(
    async (appointmentType: AppointmentType = "adjustments") => {
      const sessionNumber = totalSessionsDone + 1
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
    },
    [
      patientId,
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

  const deleteDocumentRecord = useCallback(
    (id: string) => {
      setDeletedDocumentIds((prev) => {
        const next = [...prev, id]
        writeField(patientId, "deletedDocumentIds", next)
        return next
      })
    },
    [patientId],
  )

  return {
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
