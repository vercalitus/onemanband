"use client"

import { Calendar, CheckCircle2, Receipt } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { AppointmentEditDialog } from "@/features/dashboard/components/appointment-edit-dialog"
import { todaySchedule } from "@/lib/mock-data"
import type { ScheduleItem } from "@/types/domain"

interface Props {
  /** Debt amount in ILS — shows amber hint when > 0 */
  outstandingDebt: number
  /** Called when practitioner taps "Complete Session" */
  onCompleteSession: () => void
  /** Called when practitioner taps "Issue Invoice" */
  onIssueInvoice: () => void
  /** Patient id for pre-filling the schedule dialog */
  patientId: string
  patientName: string
  /** Default treatment duration from last treatment type or settings */
  defaultDurationMinutes?: number
}

const BTN_BASE =
  "flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-base font-semibold shadow-[0_4px_14px_-4px_rgba(15,23,42,0.2)] transition-all active:scale-[0.97] sm:py-5 md:flex-1 md:py-4"

export function PatientActionBar({
  outstandingDebt,
  onCompleteSession,
  onIssueInvoice,
  patientId,
  patientName,
  defaultDurationMinutes = 35,
}: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const router = useRouter()

  /** Build a prefilled "next appointment" stub for the dialog. */
  function buildNextAppointmentStub(): ScheduleItem {
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 7)
    const iso = nextDate.toISOString().slice(0, 10)
    const startMinutes = 9 * 60 // default 09:00
    const endMinutes = startMinutes + defaultDurationMinutes
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    return {
      id: "",
      patientId,
      patientName,
      date: iso,
      dayLabel: "",
      provider: "",
      start: hhmm(startMinutes),
      end: hhmm(endMinutes),
      status: "scheduled",
      treatment: "",
      appointmentType: "adjustments",
    }
  }

  const [allAppointments] = useState<ScheduleItem[]>(todaySchedule)

  const handleScheduleSaved = (item: ScheduleItem, meta: { isNew: boolean }) => {
    setScheduleOpen(false)
    if (meta.isNew) {
      router.push("/calendar")
    }
  }

  const hasDebt = outstandingDebt > 0
  const debtLabel = hasDebt
    ? `₪${outstandingDebt.toLocaleString("he-IL")} outstanding`
    : undefined

  return (
    <>
      {/* ── Mobile / tablet: sticky bottom bar ── */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2.5 border-t border-slate-200/80 bg-white/95 p-4 backdrop-blur-md sm:flex-row xl:hidden",
          "shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.14)]",
        )}
        aria-label="Quick actions"
      >
        {/* Complete Session */}
        <button
          type="button"
          onClick={onCompleteSession}
          className={cn(BTN_BASE, "bg-slate-900 text-white hover:bg-slate-800")}
          aria-label="Complete current session"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          Complete Session
        </button>

        {/* Issue Invoice */}
        <button
          type="button"
          onClick={onIssueInvoice}
          className={cn(
            BTN_BASE,
            hasDebt
              ? "bg-amber-500 text-white hover:bg-amber-400"
              : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-none",
          )}
          aria-label={hasDebt ? `Issue invoice — ${debtLabel}` : "Issue invoice"}
        >
          <Receipt className="size-5 shrink-0" aria-hidden />
          <span className="flex flex-col items-start leading-none">
            <span>Issue Invoice</span>
            {hasDebt && (
              <span className="mt-0.5 text-[11px] font-normal opacity-90">{debtLabel}</span>
            )}
          </span>
        </button>

        {/* Schedule Next */}
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className={cn(BTN_BASE, "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-none")}
          aria-label="Schedule next appointment"
        >
          <Calendar className="size-5 shrink-0" aria-hidden />
          Schedule Next
        </button>
      </div>

      {/* ── Desktop sidebar card ── */}
      <aside className="hidden xl:flex xl:w-[220px] xl:shrink-0 xl:flex-col xl:gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.10)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Quick actions
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onCompleteSession}
              className="flex w-full items-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98]"
            >
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Complete Session
            </button>

            <button
              type="button"
              onClick={onIssueInvoice}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors active:scale-[0.98]",
                hasDebt
                  ? "bg-amber-500 text-white hover:bg-amber-400"
                  : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
              )}
            >
              <Receipt className="size-4 shrink-0" aria-hidden />
              <span className="flex flex-col items-start leading-none">
                <span>Issue Invoice</span>
                {hasDebt && (
                  <span className="mt-0.5 text-[10px] font-normal opacity-90">{debtLabel}</span>
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:scale-[0.98]"
            >
              <Calendar className="size-4 shrink-0" aria-hidden />
              Schedule Next
            </button>
          </div>
        </div>
      </aside>

      {/* Appointment dialog */}
      <AppointmentEditDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        mode="create"
        appointment={buildNextAppointmentStub()}
        defaultDate={buildNextAppointmentStub().date}
        allAppointments={allAppointments}
        onSave={handleScheduleSaved}
      />
    </>
  )
}
