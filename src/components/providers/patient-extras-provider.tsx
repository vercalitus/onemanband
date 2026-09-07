"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { createPatient, fetchPatients } from "@/features/patients/lib/patient-repository"
import { patients as mockPatients } from "@/lib/mock-data"
import type { PatientSummary } from "@/types/domain"

type PatientExtrasContextValue = {
  extras: PatientSummary[]
  addPatient: (patient: PatientSummary) => void
  /** Patients read from the database, or null while unknown / unavailable. */
  live: PatientSummary[] | null
  /**
   * True until the first read has resolved.
   *
   * Distinct from `live === null`, which cannot tell "still asking" from "no
   * database". A page that decides a patient does not exist needs the
   * difference: without it, `/patients/<uuid>` renders 404 in the moment before
   * the real list arrives, and a real record looks deleted.
   */
  loading: boolean
  refreshLive: () => void
}

const PatientExtrasContext = createContext<PatientExtrasContextValue | null>(null)

/**
 * Patients, from the database where there are any and from the mock file
 * otherwise.
 *
 * The switch is the data itself rather than a flag, and that is deliberate: as
 * long as the clinic has entered nobody, the demo dataset keeps the app usable
 * and demonstrable; the moment one real patient exists, the invented ones stop
 * appearing. Nobody has to remember to flip anything, and there is no state
 * where real and fictional patients sit in the same list.
 *
 * A database that cannot be read is treated as no database. That is the same
 * choice made everywhere else here — an unconfigured or unreachable deploy
 * stays usable rather than showing an empty screen — and the reason is logged.
 */
export function PatientExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<PatientSummary[]>([])
  const [live, setLive] = useState<PatientSummary[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshLive = useCallback(() => {
    void fetchPatients()
      .then((result) => {
        if (result.source === "live") {
          setLive(result.patients)
          return
        }
        setLive(null)
        if (process.env.NODE_ENV === "development") {
          console.warn(`[patients] falling back to mock data: ${result.reason}`)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // After mount only: this reads a session, which does not exist during the
  // server render.
  useEffect(() => refreshLive(), [refreshLive])

  const addPatient = useCallback((patient: PatientSummary) => {
    setExtras((prev) => [patient, ...prev])
  }, [])

  const value = useMemo(
    () => ({ extras, addPatient, live, loading, refreshLive }),
    [extras, addPatient, live, loading, refreshLive],
  )
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
  const { extras, live } = usePatientExtras()
  return useMemo(() => {
    // One real patient is enough to retire the demo dataset entirely.
    if (live && live.length) return live
    return [...extras, ...mockPatients]
  }, [extras, live])
}

/**
 * Add a patient, to the database when there is one.
 *
 * Returns whether it was persisted, because the two outcomes are genuinely
 * different and the caller should be able to say so: a patient saved to
 * Postgres is a record, one held in this provider is a demo row that vanishes
 * on refresh.
 */
export function useAddPatient(): (draft: PatientSummary) => Promise<boolean> {
  const { addPatient, refreshLive } = usePatientExtras()
  return useCallback(
    async (draft: PatientSummary) => {
      const written = await createPatient({
        fullName: draft.fullName,
        phone: draft.phone,
        email: draft.email,
        address: draft.address,
        status: draft.status,
        medicalHistorySummary: draft.medicalHistorySummary,
        generalNotes: draft.generalNotes,
        tags: draft.tags,
      })
      if (written.ok) {
        refreshLive()
        return true
      }
      if (process.env.NODE_ENV === "development") {
        console.warn(`[patients] kept in session only: ${written.reason}`)
      }
      addPatient(draft)
      return false
    },
    [addPatient, refreshLive],
  )
}
