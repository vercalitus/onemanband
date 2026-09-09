"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { AddPatientDialog } from "@/features/patients/components/add-patient-dialog"
import type { AddPatientPrefill, PatientSummary } from "@/types/domain"

import { useAddPatient } from "@/components/providers/patient-extras-provider"

export interface OpenAddPatientOptions {
  /** Fields already known — from a self-registration, say — so nobody retypes them. */
  prefill?: AddPatientPrefill
  /** Runs once the write settles; `null` when the record could not be saved. */
  onSaved?: (saved: PatientSummary | null) => void
}

type GlobalAddPatientContextValue = {
  openGlobalAddPatient: (options?: OpenAddPatientOptions) => void
}

const GlobalAddPatientContext = createContext<GlobalAddPatientContextValue | null>(null)

export function useGlobalAddPatient(): GlobalAddPatientContextValue {
  const ctx = useContext(GlobalAddPatientContext)
  if (!ctx) {
    throw new Error("GlobalAddPatientProvider is missing from the tree.")
  }
  return ctx
}

/** Opens Add Patient from layout/header without navigating away. Must sit under PatientExtrasProvider. */
export function GlobalAddPatientProvider({ children }: { children: ReactNode }) {
  const addPatient = useAddPatient()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<OpenAddPatientOptions>({})

  const openGlobalAddPatient = useCallback((next: OpenAddPatientOptions = {}) => {
    setOptions(next)
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ openGlobalAddPatient }), [openGlobalAddPatient])

  return (
    <GlobalAddPatientContext.Provider value={value}>
      {children}
      <AddPatientDialog
        open={open}
        onOpenChange={setOpen}
        initial={options.prefill}
        onSave={(patient) => {
          // Closing does not wait on the write: the dialog has said its piece,
          // and the list refreshes itself when the row lands. Whoever opened
          // the dialog hears the outcome, because an intake must not be
          // closed for a patient that was never saved.
          const { onSaved } = options
          void addPatient(patient).then((saved) => onSaved?.(saved))
          setOpen(false)
        }}
      />
    </GlobalAddPatientContext.Provider>
  )
}
