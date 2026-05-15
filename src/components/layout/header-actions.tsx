"use client"

import { useState } from "react"
import { CalendarPlus, ClipboardList, Plus, Search, UserPlus } from "lucide-react"
import Link from "next/link"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAddTask } from "@/components/providers/add-task-provider"
import { useGlobalAddPatient } from "@/components/providers/global-add-patient-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"

const MOCK_RESULTS = [
  { type: "Patient", label: "Maya Green", href: "/patients/p1" },
  { type: "Patient", label: "Noah Stone", href: "/patients/p2" },
  { type: "Appointment", label: "Today 08:30 — Maya Green", href: "/calendar" },
  { type: "Appointment", label: "Today 10:15 — Noah Stone", href: "/calendar" },
  { type: "Billing", label: "Invoice #1042 — $340", href: "/finances" },
]

/** One dialog root only — avoids Base UI / focus issues from nested multiple modals */
type HeaderModal = null | "search" | "add"

export function HeaderActions() {
  const { openAddTask } = useAddTask()
  const { openGlobalAddPatient } = useGlobalAddPatient()
  const { openCreateAppointment } = useScheduleDay()
  const [modal, setModal] = useState<HeaderModal>(null)
  const [query, setQuery] = useState("")

  const results =
    query.length > 0
      ? MOCK_RESULTS.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
      : MOCK_RESULTS

  const closeModal = () => {
    setModal(null)
    setQuery("")
  }

  return (
    <>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setModal("search")}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50 hover:text-sky-900 sm:gap-2 sm:px-4 md:px-5"
          aria-label="Search"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden sm:inline">Search</span>
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setModal("add")}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-medium text-sky-700 outline-none transition-colors hover:bg-sky-50 hover:text-sky-900 sm:gap-2 sm:px-4 md:px-5"
          aria-label="Add new"
          aria-haspopup="dialog"
          aria-expanded={modal === "add"}
        >
          <Plus className="size-4 shrink-0" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      <Dialog
        modal={false}
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <DialogContent
          showCloseButton
          className={
            modal === "search"
              ? "gap-0 overflow-hidden rounded-3xl border-slate-100 p-0 shadow-2xl sm:max-w-xl"
              : "max-w-md gap-0 overflow-hidden rounded-3xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-md"
          }
        >
          <DialogTitle className="sr-only">
            {modal === "search" ? "Search" : modal === "add" ? "Add" : "Dialog"}
          </DialogTitle>

          {modal === "search" && (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <Search className="size-4 shrink-0 text-sky-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patients, appointments, invoices..."
                  className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <kbd className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-400 sm:block">
                  ESC
                </kbd>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No results found.</p>
                ) : (
                  results.map((r) => (
                    <Link
                      key={r.href + r.label}
                      href={r.href}
                      onClick={() => closeModal()}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-slate-50"
                    >
                      <span className="w-20 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-center text-[10px] font-medium text-slate-500">
                        {r.type}
                      </span>
                      <span className="text-slate-800">{r.label}</span>
                    </Link>
                  ))
                )}
              </div>
            </>
          )}

          {modal === "add" && (
            <div className="flex flex-col gap-2 p-4 pt-5">
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openGlobalAddPatient()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <UserPlus className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-slate-900">Add patient</span>
                  <span className="mt-0.5 block text-sm text-slate-500">New patient record</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openCreateAppointment()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <CalendarPlus className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-slate-900">Add appointment</span>
                  <span className="mt-0.5 block text-sm text-slate-500">Schedule a visit</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openAddTask()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <ClipboardList className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-slate-900">Add task</span>
                  <span className="mt-0.5 block text-sm text-slate-500">Reminder or follow-up</span>
                </span>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
