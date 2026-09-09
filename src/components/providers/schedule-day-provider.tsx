"use client"

import { AlertTriangle } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import {
  APPOINTMENT_OVERLAY_EVENT,
  applyAppointmentOverlay,
} from "@/features/automations/lib/appointment-overlay"
import { useAppointmentAutomations } from "@/features/automations/lib/use-appointment-automations"
import { useNoShowWatcher } from "@/features/automations/lib/use-no-show-watcher"
import {
  APPOINTMENTS_CHANGED_EVENT,
  fetchAppointments,
  saveAppointment,
} from "@/features/calendar/lib/appointment-repository"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { isSupabaseConfigured } from "@/lib/env"
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
import type { AppointmentType, ScheduleItem } from "@/types/domain"

function sortByStart(list: ScheduleItem[]) {
  return [...list].sort((a, b) => minutesFromHHMM(a.start) - minutesFromHHMM(b.start))
}

type ScheduleDayContextValue = {
  appointments: ScheduleItem[]
  setAppointments: Dispatch<SetStateAction<ScheduleItem[]>>
  /**
   * The one way a booking changes: create, edit, move, cancel, complete.
   *
   * Every calendar used to do this itself — update the list, then tell the
   * automation engine. Two of them only ever updated the list, so a visit
   * booked on the calendar page or the dashboard grid was gone on the next
   * load; the one that did write it through never told the engine, so a visit
   * booked from the chart got no confirmation and no reminder. One path, and
   * the engine hears about the row the database actually holds, under the id
   * a later cancellation will use.
   */
  commitAppointment: (item: ScheduleItem, meta: { isNew: boolean }) => void
  /**
   * Opens the "New Appointment" dialog. Accepts an optional ISO date so callers
   * (e.g. the calendar's mini-calendar) can pre-select the day the user clicked.
   */
  openCreateAppointment: (
    defaultDate?: string,
    patient?: { id: string; name: string },
    defaults?: { appointmentType?: AppointmentType; treatment?: string },
  ) => void
  /**
   * Mark a booking confirmed, from wherever the practitioner happens to be.
   *
   * Exposed because the dashboard's "confirm tomorrow's appointment" signal
   * should finish the job where it is asked. Sending someone to the calendar to
   * change one status is most of the work and all of the friction.
   */
  confirmAppointment: (id: string) => void
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
  /*
   * The demo day, only where there is no database to ask.
   *
   * A configured deploy starts empty and waits for the real diary. It used to
   * start on the demo day regardless, for the second or two before the read
   * came back — and a demo visit is a link to `/patients/pt-004`, which is not
   * a patient. Nothing invented is shown while the truth is on its way.
   *
   * `isSupabaseConfigured` reads public env, so the server render and the
   * client agree on the initial list and hydration is unaffected.
   */
  const [appointments, setAppointments] = useState<ScheduleItem[]>(() =>
    isSupabaseConfigured() ? [] : [...todaySchedule, ...weeklySchedule],
  )
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
    void Promise.all([fetchAppointments(), clinicHasPatients()]).then(
      ([result, hasPatients]) => {
        if (result.source !== "live") {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[schedule] falling back to mock data: ${result.reason}`)
          }
          return
        }
        if (!result.appointments.length) {
          // A clinic with real patients and no bookings has an empty diary, and
          // saying so is the truth. Showing the demo day here would offer
          // visits by people who do not exist and link to records that are not
          // there.
          if (hasPatients) {
            setLive(true)
            setAppointments([])
          }
          return
        }
        setLive(true)
        setAppointments(sortByStart(result.appointments))
      },
    )
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
  const syncAutomations = useAppointmentAutomations()
  // Read through a ref: a commit needs the list as it is at that moment, not
  // as it was when the callback was built.
  const latest = useRef(appointments)
  latest.current = appointments
  const [headerCreateOpen, setHeaderCreateOpen] = useState(false)
  const [headerDefaultStart, setHeaderDefaultStart] = useState<number | undefined>(undefined)
  const [headerDefaultDate, setHeaderDefaultDate] = useState<string | undefined>(undefined)
  // When opened for a specific patient (e.g. from search), carry them into the
  // dialog as a create-mode stub so the appointment links to that patient.
  const [headerStub, setHeaderStub] = useState<ScheduleItem | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const openCreateAppointment = useCallback(
    (
      defaultDate?: string,
      patient?: { id: string; name: string },
      defaults?: { appointmentType?: AppointmentType; treatment?: string },
    ) => {
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
              treatment: defaults?.treatment ?? "",
              appointmentType: defaults?.appointmentType ?? "adjustments",
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
    async (item: ScheduleItem, { isNew }: { isNew: boolean }): Promise<ScheduleItem | null> => {
      if (!live) return null
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
        window.dispatchEvent(new Event(APPOINTMENTS_CHANGED_EVENT))
        return written.appointment
      }
      setSaveError(written.reason)
      refresh()
      return null
    },
    [live, refresh],
  )

  const commitAppointment = useCallback(
    (item: ScheduleItem, { isNew }: { isNew: boolean }) => {
      const previous = isNew ? null : (latest.current.find((a) => a.id === item.id) ?? null)
      // Optimistic locally so the grid moves under the hand, then written
      // through. Postgres owns the overlap rule, so a booking it refuses is
      // taken back off the board rather than left looking saved.
      setAppointments((prev) =>
        sortByStart(isNew ? [...prev, item] : prev.map((a) => (a.id === item.id ? item : a))),
      )
      if (!live) {
        // The demo day: the local list is the whole truth, and the engine
        // plans against it so the demo still shows what a booking triggers.
        void syncAutomations(item, { isNew, previous })
        return
      }
      // The engine hears about the saved row, never the draft: a new booking's
      // id is minted by the database, and a reminder queued under the draft's
      // id could never be cancelled by the appointment it belongs to.
      void persist(item, { isNew }).then((saved) => {
        if (saved) void syncAutomations(saved, { isNew, previous })
      })
    },
    [live, persist, syncAutomations],
  )

  const confirmAppointment = useCallback(
    (id: string) => {
      const current = latest.current.find((a) => a.id === id)
      if (!current || current.status === "confirmed") return
      commitAppointment({ ...current, status: "confirmed" }, { isNew: false })
    },
    [commitAppointment],
  )

  const value = useMemo(
    () => ({
      appointments,
      setAppointments,
      openCreateAppointment,
      commitAppointment,
      confirmAppointment,
      saveError,
      clearSaveError: () => setSaveError(null),
    }),
    [appointments, openCreateAppointment, commitAppointment, confirmAppointment, saveError],
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
          setHeaderCreateOpen(false)
          commitAppointment(item, { isNew })
        }}
      />
    </ScheduleDayContext.Provider>
  )
}
