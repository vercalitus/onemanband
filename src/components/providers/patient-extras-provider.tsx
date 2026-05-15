"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { patients as mockPatients } from "@/lib/mock-data"
import type { PatientSummary } from "@/types/domain"

type PatientExtrasContextValue = {
  extras: PatientSummary[]
  addPatient: (patient: PatientSummary) => void
}

const PatientExtrasContext = createContext<PatientExtrasContextValue | null>(null)

/** Demo-only store: patients created in-session sit ahead of mock seed data. */
export function PatientExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<PatientSummary[]>([])
  const addPatient = useCallback((patient: PatientSummary) => {
    setExtras((prev) => [patient, ...prev])
  }, [])
  const value = useMemo(() => ({ extras, addPatient }), [extras, addPatient])
  return <PatientExtrasContext.Provider value={value}>{children}</PatientExtrasContext.Provider>
}

export function usePatientExtras() {
  const ctx = useContext(PatientExtrasContext)
  if (!ctx) {
    throw new Error("PatientExtrasProvider is missing from the tree.")
  }
  return ctx
}

export function useMergedPatients(): PatientSummary[] {
  const { extras } = usePatientExtras()
  return useMemo(() => [...extras, ...mockPatients], [extras])
}
