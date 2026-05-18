"use client"

import { BellDot } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderBarDate } from "@/components/layout/header-bar-date"
import { HeaderActions } from "@/components/layout/header-actions"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AddTaskProvider } from "@/components/providers/add-task-provider"
import { GlobalAddPatientProvider } from "@/components/providers/global-add-patient-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { PatientExtrasProvider } from "@/components/providers/patient-extras-provider"
import { ScheduleDayProvider } from "@/components/providers/schedule-day-provider"
import { TodosProvider } from "@/components/providers/todos-provider"
import { Button } from "@/components/ui/button"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, isRtl } = useLocale()

  const mainColumn = (
    <div className="relative flex min-h-screen min-w-0 max-w-full flex-1 flex-col bg-background shadow-[-6px_0_28px_-14px_rgba(15,23,42,0.06)] rtl:shadow-[6px_0_28px_-14px_rgba(15,23,42,0.06)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
        <div className="flex min-h-14 w-full min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 sm:gap-x-4 sm:px-6 md:flex-nowrap md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <MobileNav />
            <HeaderBarDate />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            <HeaderActions />
            <LocaleSwitcher />
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 border-slate-100 bg-white shadow-none"
              aria-label={t("header.notifications")}
            >
              <BellDot className="size-4 text-sky-600" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 max-w-full px-4 pb-3 pt-7 sm:px-6 md:px-8 md:pt-8">{children}</main>
    </div>
  )

  return (
    <TodosProvider>
      <AddTaskProvider>
        <PatientExtrasProvider>
          <GlobalAddPatientProvider>
            <ScheduleDayProvider>
              <div className="min-h-screen bg-background">
                <div className="mx-auto flex min-h-screen min-w-0 max-w-[1680px] flex-row">
                  {!isRtl ? <AppSidebar /> : null}
                  {mainColumn}
                  {isRtl ? <AppSidebar /> : null}
                </div>
              </div>
            </ScheduleDayProvider>
          </GlobalAddPatientProvider>
        </PatientExtrasProvider>
      </AddTaskProvider>
    </TodosProvider>
  )
}
