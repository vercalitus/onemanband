"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { treatmentsByPatient, documentsByPatient, financesByPatient } from "@/lib/mock-data"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { AppointmentType, TreatmentRecord, DocumentRecord, FinanceRecord } from "@/types/domain"

export interface CompletedSession {
  id: string
  completedAt: string
  /** e.g. "Session 3 of 10 — Adjustments" */
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

const DEFAULT_CLINICAL_STATUS =
  "שיפור הדרגתי בטווח תנועה צווארי, דגש על יציבה בעבודה"

const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  first: "First Visit",
  adjustments: "Adjustments",
  kupa: "Kupa",
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
  const [clinicalStatus, setClinicalStatusRaw] = useState(DEFAULT_CLINICAL_STATUS)
  const [sessionNotes, setSessionNotesRaw] = useState("")
  const [canvasDataUrl, setCanvasDataUrlRaw] = useState<string | null>(null)
  const [completedSessions, setCompletedSessionsRaw] = useState<CompletedSession[]>([])
  const [deletedTreatmentIds, setDeletedTreatmentIds] = useState<string[]>([])
  const [deletedDocumentIds, setDeletedDocumentIds] = useState<string[]>([])
  const [contactOverrides, setContactOverridesRaw] = useState<PatientContactOverrides>({})
  const [lastAppointmentType, setLastAppointmentTypeRaw] = useState<AppointmentType>("adjustments")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setClinicalStatusRaw(readField(patientId, "clinicalStatus", DEFAULT_CLINICAL_STATUS))
    setSessionNotesRaw(readField(patientId, "sessionNotes", ""))
    setCanvasDataUrlRaw(readField(patientId, "canvasDataUrl", null))
    setCompletedSessionsRaw(readField(patientId, "completedSessions", []))
    setDeletedTreatmentIds(readField(patientId, "deletedTreatmentIds", []))
    setDeletedDocumentIds(readField(patientId, "deletedDocumentIds", []))
    setContactOverridesRaw(readField(patientId, "contactOverrides", {}))
    setLastAppointmentTypeRaw(readField(patientId, "lastAppointmentType", "adjustments"))
    setHydrated(true)
  }, [patientId])

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

  /** Raw mock records, filtered by soft-deleted IDs */
  const treatmentRecords: TreatmentRecord[] = useMemo(() => {
    const all = treatmentsByPatient[patientId] ?? []
    return all.filter((r) => !deletedTreatmentIds.includes(r.id))
  }, [patientId, deletedTreatmentIds])

  const documentRecords: DocumentRecord[] = useMemo(() => {
    const all = documentsByPatient[patientId] ?? []
    return all.filter((r) => !deletedDocumentIds.includes(r.id))
  }, [patientId, deletedDocumentIds])

  const financeRecords: FinanceRecord[] = useMemo(() => {
    return financesByPatient[patientId] ?? []
  }, [patientId])

  const planTarget = useMemo(() => {
    try {
      return readClinicSettings().defaultPlanSessions ?? 10
    } catch {
      return 10
    }
  }, [])

  const totalSessionsDone = treatmentRecords.length + completedSessions.length

  /**
   * Complete the active session: creates a titled timeline entry using the
   * current sequence number and appointment type, then clears the workspace.
   */
  const completeSession = useCallback(
    (appointmentType: AppointmentType = "adjustments") => {
      const sessionNumber = totalSessionsDone + 1
      const typeLabel = APPOINTMENT_TYPE_LABELS[appointmentType]
      const title = `Session ${sessionNumber} of ${planTarget} — ${typeLabel}`

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
      setSessionNotes,
      setCanvasDataUrl,
      setLastAppointmentType,
    ],
  )

  /** Soft-delete a mock TreatmentRecord */
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

  /** Remove a CompletedSession from the timeline */
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

  /** Soft-delete a mock DocumentRecord */
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
