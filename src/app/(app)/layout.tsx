"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderBarDate } from "@/components/layout/header-bar-date"
import { HeaderActions } from "@/components/layout/header-actions"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { AddTaskProvider } from "@/components/providers/add-task-provider"
import { GlobalAddPatientProvider } from "@/components/providers/global-add-patient-provider"
import { PatientExtrasProvider } from "@/components/providers/patient-extras-provider"
import { ScheduleDayProvider } from "@/components/providers/schedule-day-provider"
import { TodosProvider } from "@/components/providers/todos-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const mainColumn = (
    <div className="relative flex min-h-screen min-w-0 max-w-full flex-1 flex-col bg-background">
      {/* The plate: the cobalt band across the top, the other half of the L the
          rail starts (DESIGN.md). It carries the day in display numerals. It
          scrolls away with the page rather than sticking: on an iPad in
          landscape a 96px band held in place is an eighth of the screen. */}
      <header className="on-cobalt bg-cobalt text-white">
        <div className="flex min-h-24 w-full min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <MobileNav />
            <HeaderBarDate />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <HeaderActions />
            <LocaleSwitcher />
            {/*
             * No notification bell.
             *
             * It was a button with no handler and a permanently-lit dot — an
             * alert that never meant anything, which trains you to ignore the
             * ones that do. Everything needing attention (patient responses,
             * failed sends, derived signals) lives in the dashboard board's
             * "needs attention" half instead, where it can actually be acted
             * on. The `header.notifications` i18n key is kept for reuse.
             */}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 max-w-full px-4 pb-3 pt-6 sm:px-6 md:pt-8">{children}</main>
    </div>
  )

  return (
    <TodosProvider>
      <AddTaskProvider>
        <PatientExtrasProvider>
          <GlobalAddPatientProvider>
            <ScheduleDayProvider>
              <div className="min-h-screen bg-background">
                <div className="flex min-h-screen min-w-0 flex-row">
                  {/*
                   * With dir=rtl + flex-row, DOM order determines visual placement:
                   * first child sits at inline-start (= right in RTL). Render sidebar first
                   * so it stays visually on the right in Hebrew layout.
                   */}
                  <AppSidebar />
                  {mainColumn}
                </div>
              </div>
            </ScheduleDayProvider>
          </GlobalAddPatientProvider>
        </PatientExtrasProvider>
      </AddTaskProvider>
    </TodosProvider>
  )
}
