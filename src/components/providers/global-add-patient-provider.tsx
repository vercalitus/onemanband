"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { AddPatientDialog } from "@/features/patients/components/add-patient-dialog"

import { useAddPatient } from "@/components/providers/patient-extras-provider"

type GlobalAddPatientContextValue = {
  openGlobalAddPatient: () => void
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

  const openGlobalAddPatient = useCallback(() => {
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ openGlobalAddPatient }), [openGlobalAddPatient])

  return (
    <GlobalAddPatientContext.Provider value={value}>
      {children}
      <AddPatientDialog
        open={open}
        onOpenChange={setOpen}
        onSave={(patient) => {
          // Closing does not wait on the write: the dialog has said its piece,
          // and the list refreshes itself when the row lands.
          void addPatient(patient)
          setOpen(false)
        }}
      />
    </GlobalAddPatientContext.Provider>
  )
}
