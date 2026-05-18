"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  localizeDocumentRecord,
  localizeFinanceRecord,
  localizeTreatmentRecord,
} from "@/lib/i18n/localized-seed"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { Locale } from "@/lib/i18n/types"
import { treatmentsByPatient, documentsByPatient, financesByPatient } from "@/lib/mock-data"
import type { AppointmentType, TreatmentRecord, DocumentRecord, FinanceRecord } from "@/types/domain"

export interface CompletedSession {
  id: string
  completedAt: string
  /** e.g. localized "Session 3 of 10 — Adjustments" or Hebrew equivalent */
  title: string
  sessionNotes: string
  canvasDataUrl: string | null
}

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

const LEGACY_CLINICAL_STATUS_HE =
  "שיפור הדרגתי בטווח תנועה צווארי, דגש על יציבה בעבודה"

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

/** Map stored defaults across locales without persisting until the user edits. */
function normalizeClinicalRead(stored: string | null | undefined, locale: Locale): string {
  const t = (stored ?? "").trim()
  if (t === "" || t === LEGACY_CLINICAL_STATUS_HE.trim()) {
    return locale === "he" ? DEFAULT_CLINICAL_HE : DEFAULT_CLINICAL_EN
  }
  if (locale === "he" && t === DEFAULT_CLINICAL_EN) return DEFAULT_CLINICAL_HE
  if (locale === "en" && t === DEFAULT_CLINICAL_HE) return DEFAULT_CLINICAL_EN
  return stored ?? (locale === "he" ? DEFAULT_CLINICAL_HE : DEFAULT_CLINICAL_EN)
}

export function usePatientCockpit(patientId: string) {
  const { t, locale } = useLocale()
  const [clinicalStatus, setClinicalStatusRaw] = useState(DEFAULT_CLINICAL_EN)
  const [sessionNotes, setSessionNotesRaw] = useState("")
  const [canvasDataUrl, setCanvasDataUrlRaw] = useState<string | null>(null)
  const [completedSessions, setCompletedSessionsRaw] = useState<CompletedSession[]>([])
  const [deletedTreatmentIds, setDeletedTreatmentIds] = useState<string[]>([])
  const [deletedDocumentIds, setDeletedDocumentIds] = useState<string[]>([])
  const [contactOverrides, setContactOverridesRaw] = useState<PatientContactOverrides>({})
  const [lastAppointmentType, setLastAppointmentTypeRaw] = useState<AppointmentType>("adjustments")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const rawClinical = readField<string | null>(patientId, "clinicalStatus", null)
    setClinicalStatusRaw(normalizeClinicalRead(rawClinical, locale))

    setSessionNotesRaw(readField(patientId, "sessionNotes", ""))
    setCanvasDataUrlRaw(readField(patientId, "canvasDataUrl", null))
    setCompletedSessionsRaw(readField(patientId, "completedSessions", []))
    setDeletedTreatmentIds(readField(patientId, "deletedTreatmentIds", []))
    setDeletedDocumentIds(readField(patientId, "deletedDocumentIds", []))
    setContactOverridesRaw(readField(patientId, "contactOverrides", {}))
    setLastAppointmentTypeRaw(readField(patientId, "lastAppointmentType", "adjustments"))
    setHydrated(true)
  }, [patientId, locale])

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

  const setCanvasDataUrl = useCallback(
    (value: string | null) => {
      setCanvasDataUrlRaw(value)
      writeField(patientId, "canvasDataUrl", value)
    },
    [patientId],
  )

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
    (appointmentType: AppointmentType = "adjustments") => {
      const sessionNumber = totalSessionsDone + 1
      const typeLabel = t(`billing.treatment.${appointmentType}`)
      const title = t("patientChart.sessionCompleteTitle", {
        n: sessionNumber,
        total: planTarget,
        type: typeLabel,
      })

      const entry: CompletedSession = {
        id: `cs-${Date.now()}`,
        completedAt: new Date().toISOString(),
        title,
        sessionNotes,
        canvasDataUrl,
      }
      setCompletedSessionsRaw((prev) => {
        const next = [entry, ...prev]
        writeField(patientId, "completedSessions", next)
        return next
      })
      setLastAppointmentType(appointmentType)
      setSessionNotes("")
      setCanvasDataUrl(null)
    },
    [
      patientId,
      totalSessionsDone,
      planTarget,
      sessionNotes,
      canvasDataUrl,
      setLastAppointmentType,
      setSessionNotes,
      setCanvasDataUrl,
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
    canvasDataUrl,
    setCanvasDataUrl,
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
  }
}
