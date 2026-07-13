"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  clampStartForDuration,
  minutesFromHHMM,
  snapMinutesToSlotNearest,
} from "@/lib/appointment-time"
import { toISODate } from "@/lib/date-helpers"
import { todaySchedule, weeklySchedule } from "@/lib/mock-data"
import type { ScheduleItem } from "@/types/domain"

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

type ScheduleDayContextValue = {
  appointments: ScheduleItem[]
  setAppointments: Dispatch<SetStateAction<ScheduleItem[]>>
  /**
   * Opens the "New Appointment" dialog. Accepts an optional ISO date so callers
   * (e.g. the calendar's mini-calendar) can pre-select the day the user clicked.
   */
  openCreateAppointment: (
    defaultDate?: string,
    patient?: { id: string; name: string },
  ) => void
}

const ScheduleDayContext = createContext<ScheduleDayContextValue | null>(null)

export function useScheduleDay(): ScheduleDayContextValue {
  const ctx = useContext(ScheduleDayContext)
  if (!ctx) {
    throw new Error("ScheduleDayProvider is missing from the tree.")
  }
  return ctx
}

/** Shared schedule store + globally-triggered "create appointment" dialog (no route change). */
export function ScheduleDayProvider({ children }: { children: ReactNode }) {
  // Seed with today + a few illustrative future visits so the week/month views
  // surface data outside today on first load.
  const [appointments, setAppointments] = useState<ScheduleItem[]>(() => [
    ...todaySchedule,
    ...weeklySchedule,
  ])
  const [headerCreateOpen, setHeaderCreateOpen] = useState(false)
  const [headerDefaultStart, setHeaderDefaultStart] = useState<number | undefined>(undefined)
  const [headerDefaultDate, setHeaderDefaultDate] = useState<string | undefined>(undefined)
  // When opened for a specific patient (e.g. from search), carry them into the
  // dialog as a create-mode stub so the appointment links to that patient.
  const [headerStub, setHeaderStub] = useState<ScheduleItem | null>(null)

  const openCreateAppointment = useCallback(
    (defaultDate?: string, patient?: { id: string; name: string }) => {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const dayStartMin = CALENDAR_HOUR_START * 60
      const dayEndMin = CALENDAR_HOUR_END * 60
      const defaultDuration = 15
      let snapped = snapMinutesToSlotNearest(currentMinutes)
      if (currentMinutes < dayStartMin || currentMinutes >= dayEndMin) {
        snapped = dayStartMin + 60
      }
      const clamped = clampStartForDuration(snapped, defaultDuration)
      const hhmm = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
      const dateISO = defaultDate ?? toISODate(new Date())
      setHeaderDefaultStart(clamped)
      setHeaderDefaultDate(dateISO)
      setHeaderStub(
        patient
          ? {
              id: "",
              patientId: patient.id,
              patientName: patient.name,
              date: dateISO,
              dayLabel: "",
              provider: "",
              start: hhmm(clamped),
              end: hhmm(clamped + defaultDuration),
              status: "scheduled",
              treatment: "",
              appointmentType: "adjustments",
            }
          : null,
      )
      setHeaderCreateOpen(true)
    },
    [],
  )

  const value = useMemo(
    () => ({
      appointments,
      setAppointments,
      openCreateAppointment,
    }),
    [appointments, openCreateAppointment],
  )

  return (
    <ScheduleDayContext.Provider value={value}>
      {children}
      <AppointmentEditDialog
        open={headerCreateOpen}
        onOpenChange={setHeaderCreateOpen}
        mode="create"
        appointment={headerStub}
        defaultStartMinutes={headerDefaultStart}
        defaultDate={headerDefaultDate}
        allAppointments={appointments}
        onSave={(item, { isNew }) => {
          if (isNew) setAppointments((prev) => sortByStart([...prev, item]))
          else setAppointments((prev) => sortByStart(prev.map((a) => (a.id === item.id ? item : a))))
          setHeaderCreateOpen(false)
        }}
      />
    </ScheduleDayContext.Provider>
  )
}
