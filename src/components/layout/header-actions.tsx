"use client"

import { useMemo, useState } from "react"
import { CalendarPlus, ClipboardList, Plus, Search, UserPlus } from "lucide-react"
import Link from "next/link"

import { useLocale } from "@/components/providers/locale-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAddTask } from "@/components/providers/add-task-provider"
import { useGlobalAddPatient } from "@/components/providers/global-add-patient-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { localizePatient } from "@/lib/i18n/localized-seed"
import { patients } from "@/lib/mock-data"

type SearchRow = {
  label: string
  href: string
  typeLabel: string
}

/** Header search/quick-add — typed labels plus demo rows match localized patient names. */
export function HeaderActions() {
  const { t, locale, formatMoney } = useLocale()
  const { openAddTask } = useAddTask()
  const { openGlobalAddPatient } = useGlobalAddPatient()
  const { openCreateAppointment } = useScheduleDay()
  const [modal, setModal] = useState<null | "search" | "add">(null)
  const [query, setQuery] = useState("")

  const mockResults = useMemo((): SearchRow[] => {
    const pMaya =
      patients.find((p) => p.id === "pt-001") ?? patients[0]
    const pNoah =
      patients.find((p) => p.id === "pt-002") ?? patients[1]
    const maya = localizePatient(pMaya, locale)
    const noah = localizePatient(pNoah, locale)
    return [
      {
        typeLabel: t("header.search.type.patient"),
        label: maya.fullName,
        href: `/patients/${maya.id}`,
      },
      {
        typeLabel: t("header.search.type.patient"),
        label: noah.fullName,
        href: `/patients/${noah.id}`,
      },
      {
        typeLabel: t("header.search.type.appointment"),
        label: t("header.search.sampleApt1", { time: "08:30", name: maya.fullName }),
        href: "/calendar",
      },
      {
        typeLabel: t("header.search.type.appointment"),
        label: t("header.search.sampleApt2", { time: "10:15", name: noah.fullName }),
        href: "/calendar",
      },
      {
        typeLabel: t("header.search.type.billing"),
        label: t("header.search.sampleBilling", { id: "1042", amount: formatMoney(340) }),
        href: "/finances",
      },
    ]
  }, [locale, t, formatMoney])

  const results =
    query.length > 0
      ? mockResults.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
      : mockResults

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
          aria-label={t("header.search")}
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden sm:inline">{t("header.search")}</span>
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setModal("add")}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-medium text-sky-700 outline-none transition-colors hover:bg-sky-50 hover:text-sky-900 sm:gap-2 sm:px-4 md:px-5"
          aria-label={t("header.add")}
          aria-haspopup="dialog"
          aria-expanded={modal === "add"}
        >
          <Plus className="size-4 shrink-0" />
          <span className="hidden sm:inline">{t("header.add")}</span>
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
              : "max-w-md gap-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-md"
          }
        >
          <DialogTitle className="sr-only">
            {modal === "search" ? t("header.search.title") : modal === "add" ? t("header.add.title") : ""}
          </DialogTitle>

          {modal === "search" && (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <Search className="size-4 shrink-0 text-sky-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("header.dialog.searchPlaceholder")}
                  dir="auto"
                  className="min-w-0 flex-1 bg-transparent text-start text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <kbd className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-400 sm:block">
                  ESC
                </kbd>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <p className="px-5 py-4 text-start text-sm text-slate-400">{t("header.dialog.noResults")}</p>
                ) : (
                  results.map((r) => (
                    <Link
                      key={r.href + r.label}
                      href={r.href}
                      onClick={() => closeModal()}
                      className="flex items-center gap-3 px-5 py-2.5 text-start text-sm transition-colors hover:bg-slate-50"
                    >
                      <span className="w-20 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-center text-[10px] font-medium text-slate-500">
                        {r.typeLabel}
                      </span>
                      <span className="min-w-0 flex-1 text-slate-800">{r.label}</span>
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
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openGlobalAddPatient()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <UserPlus className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-base font-semibold text-slate-900">{t("header.add.patient.title")}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t("header.add.patient.sub")}</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openCreateAppointment()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <CalendarPlus className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-base font-semibold text-slate-900">{t("header.add.appointment.title")}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t("header.add.appointment.sub")}</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                onClick={() => {
                  closeModal()
                  openAddTask()
                }}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <ClipboardList className="size-6 stroke-[1.6]" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-base font-semibold text-slate-900">{t("header.add.task.title")}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t("header.add.task.sub")}</span>
                </span>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
