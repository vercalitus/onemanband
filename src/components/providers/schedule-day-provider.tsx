"use client"

import { AlertTriangle } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import {
  APPOINTMENT_OVERLAY_EVENT,
  applyAppointmentOverlay,
} from "@/features/automations/lib/appointment-overlay"
import { useNoShowWatcher } from "@/features/automations/lib/use-no-show-watcher"
import {
  fetchAppointments,
  saveAppointment,
} from "@/features/calendar/lib/appointment-repository"
import { useQuestionnaireFiling } from "@/features/automations/lib/use-questionnaire-filing"
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
  /**
   * Why the last booking did not stick, when the database refused it — an
   * overlap, or a duration off the five-minute grid. Null when all is well.
   */
  saveError: string | null
  clearSaveError: () => void
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
  /** True once the schedule is coming from Postgres rather than the mock file. */
  const [live, setLive] = useState(false)

  /**
   * Replace the seed with the clinic's real diary, if there is one.
   *
   * Same rule as patients: an empty table means the clinic has booked nothing
   * yet and the demo day stays, because an empty calendar and an unconfigured
   * one look identical and only one of them is worth showing. The first real
   * booking retires the illustration for good.
   */
  const refresh = useCallback(() => {
    void fetchAppointments().then((result) => {
      if (result.source !== "live" || !result.appointments.length) {
        if (result.source === "unavailable" && process.env.NODE_ENV === "development") {
          console.warn(`[schedule] falling back to mock data: ${result.reason}`)
        }
        return
      }
      setLive(true)
      setAppointments(sortByStart(result.appointments))
    })
  }, [])

  useEffect(() => refresh(), [refresh])

  /**
   * Fold in changes the patient made through a reminder link (confirmed,
   * cancelled, moved). Applied after mount rather than in the initialiser
   * because the overlay is localStorage — deriving it during render would make
   * server and client markup disagree.
   */
  useEffect(() => {
    const sync = () => setAppointments((prev) => applyAppointmentOverlay(prev))
    sync()
    window.addEventListener(APPOINTMENT_OVERLAY_EVENT, sync)
    return () => window.removeEventListener(APPOINTMENT_OVERLAY_EVENT, sync)
  }, [])

  useNoShowWatcher(appointments, setAppointments)
  useQuestionnaireFiling()
  const [headerCreateOpen, setHeaderCreateOpen] = useState(false)
  const [headerDefaultStart, setHeaderDefaultStart] = useState<number | undefined>(undefined)
  const [headerDefaultDate, setHeaderDefaultDate] = useState<string | undefined>(undefined)
  // When opened for a specific patient (e.g. from search), carry them into the
  // dialog as a create-mode stub so the appointment links to that patient.
  const [headerStub, setHeaderStub] = useState<ScheduleItem | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  /**
   * Write a booking through, and undo the optimistic change if the database
   * refuses it. Only meaningful once the schedule is live: while the demo day
   * is on screen there is nothing to write to, and the local state is the
   * whole truth.
   */
  const persist = useCallback(
    async (item: ScheduleItem, { isNew }: { isNew: boolean }) => {
      if (!live) return
      const written = await saveAppointment(item, { isNew })
      if (written.ok) {
        // Take the row back from the database: it carries the real id for a
        // new booking, and any value the database normalised.
        setAppointments((prev) =>
          sortByStart(
            isNew
              ? [...prev.filter((a) => a.id !== item.id), written.appointment]
              : prev.map((a) => (a.id === item.id ? written.appointment : a)),
          ),
        )
        return
      }
      setSaveError(written.reason)
      refresh()
    },
    [live, refresh],
  )

  const value = useMemo(
    () => ({
      appointments,
      setAppointments,
      openCreateAppointment,
      saveError,
      clearSaveError: () => setSaveError(null),
    }),
    [appointments, openCreateAppointment, saveError],
  )

  return (
    <ScheduleDayContext.Provider value={value}>
      {children}
      {/* A refused booking has already been taken off the grid, so without
          this it would simply vanish and look like a bug in the app rather
          than a slot that was already taken. */}
      {saveError && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-2.5 rounded-xl border border-rose-200/80 bg-white px-4 py-3 shadow-lg ring-1 ring-slate-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
          <p className="text-sm font-medium leading-snug text-slate-800">{saveError}</p>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="ms-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}
      <AppointmentEditDialog
        open={headerCreateOpen}
        onOpenChange={setHeaderCreateOpen}
        mode="create"
        appointment={headerStub}
        defaultStartMinutes={headerDefaultStart}
        defaultDate={headerDefaultDate}
        allAppointments={appointments}
        onSave={(item, { isNew }) => {
          // Optimistic locally so the grid moves under the hand, then written
          // through. Postgres owns the overlap rule, so a booking it refuses
          // has to be taken back off the board rather than left looking saved.
          if (isNew) setAppointments((prev) => sortByStart([...prev, item]))
          else setAppointments((prev) => sortByStart(prev.map((a) => (a.id === item.id ? item : a))))
          setHeaderCreateOpen(false)
          void persist(item, { isNew })
        }}
      />
    </ScheduleDayContext.Provider>
  )
}
