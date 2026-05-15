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
import { todaySchedule } from "@/lib/mock-data"
import type { ScheduleItem } from "@/types/domain"

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

type ScheduleDayContextValue = {
  appointments: ScheduleItem[]
  setAppointments: Dispatch<SetStateAction<ScheduleItem[]>>
  openCreateAppointment: () => void
}

const ScheduleDayContext = createContext<ScheduleDayContextValue | null>(null)

export function useScheduleDay(): ScheduleDayContextValue {
  const ctx = useContext(ScheduleDayContext)
  if (!ctx) {
    throw new Error("ScheduleDayProvider is missing from the tree.")
  }
  return ctx
}

/** Shared day-board appointments + header-triggered “create appointment” dialog (no route change). */
export function ScheduleDayProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<ScheduleItem[]>(() => [...todaySchedule])
  const [headerCreateOpen, setHeaderCreateOpen] = useState(false)
  const [headerDefaultStart, setHeaderDefaultStart] = useState<number | undefined>(undefined)

  const openCreateAppointment = useCallback(() => {
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
    setHeaderDefaultStart(clamped)
    setHeaderCreateOpen(true)
  }, [])

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
        appointment={null}
        defaultStartMinutes={headerDefaultStart}
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
