"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { treatmentsByPatient, documentsByPatient, financesByPatient } from "@/lib/mock-data"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import type { TreatmentRecord, DocumentRecord, FinanceRecord } from "@/types/domain"

export interface CompletedSession {
  id: string
  completedAt: string
  sessionNotes: string
  canvasDataUrl: string | null
}

export interface PatientCockpitState {
  clinicalStatus: string
  sessionNotes: string
  canvasDataUrl: string | null
  completedSessions: CompletedSession[]
}

const DEFAULT_CLINICAL_STATUS = "No current status set."

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
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setClinicalStatusRaw(readField(patientId, "clinicalStatus", DEFAULT_CLINICAL_STATUS))
    setSessionNotesRaw(readField(patientId, "sessionNotes", ""))
    setCanvasDataUrlRaw(readField(patientId, "canvasDataUrl", null))
    setCompletedSessionsRaw(readField(patientId, "completedSessions", []))
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

  /**
   * Marks the current session as complete. Creates a CompletedSession entry
   * from the current canvas + notes, then clears the active-session workspace.
   */
  const completeSession = useCallback(() => {
    const entry: CompletedSession = {
      id: `cs-${Date.now()}`,
      completedAt: new Date().toISOString(),
      sessionNotes,
      canvasDataUrl,
    }
    setCompletedSessionsRaw((prev) => {
      const next = [entry, ...prev]
      writeField(patientId, "completedSessions", next)
      return next
    })
    setSessionNotes("")
    setCanvasDataUrl(null)
  }, [patientId, sessionNotes, canvasDataUrl, setSessionNotes, setCanvasDataUrl])

  /** Merge static mock records with in-session completed sessions for the timeline. */
  const treatmentRecords: TreatmentRecord[] = useMemo(() => {
    return treatmentsByPatient[patientId] ?? []
  }, [patientId])

  const documentRecords: DocumentRecord[] = useMemo(() => {
    return documentsByPatient[patientId] ?? []
  }, [patientId])

  const financeRecords: FinanceRecord[] = useMemo(() => {
    return financesByPatient[patientId] ?? []
  }, [patientId])

  /**
   * Total sessions completed = mock treatment records + in-session completions.
   */
  const totalSessionsDone = treatmentRecords.length + completedSessions.length

  /**
   * Target from Settings defaultPlanSessions (falls back to 10).
   */
  const planTarget = useMemo(() => {
    try {
      return readClinicSettings().defaultPlanSessions ?? 10
    } catch {
      return 10
    }
  }, [])

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
    treatmentRecords,
    documentRecords,
    financeRecords,
    totalSessionsDone,
    planTarget,
  }
}
