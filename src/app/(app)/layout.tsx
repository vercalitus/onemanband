import { BellDot } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderBarDate } from "@/components/layout/header-bar-date"
import { HeaderActions } from "@/components/layout/header-actions"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AddTaskProvider } from "@/components/providers/add-task-provider"
import { GlobalAddPatientProvider } from "@/components/providers/global-add-patient-provider"
import { PatientExtrasProvider } from "@/components/providers/patient-extras-provider"
import { ScheduleDayProvider } from "@/components/providers/schedule-day-provider"
import { TodosProvider } from "@/components/providers/todos-provider"
import { Button } from "@/components/ui/button"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TodosProvider>
      <AddTaskProvider>
        <PatientExtrasProvider>
          <GlobalAddPatientProvider>
            <ScheduleDayProvider>
              <div className="min-h-screen bg-background">
                <div className="mx-auto flex min-h-screen min-w-0 max-w-[1680px]">
                  <AppSidebar />

                  <div className="relative flex min-h-screen min-w-0 max-w-full flex-1 flex-col border-l-[3px] border-sky-200/65 bg-white/55 shadow-[inset_18px_0_50px_-28px_rgba(56,189,248,0.14),-8px_0_32px_-18px_rgba(15,23,42,0.06)] backdrop-blur-md">
                    <header className="sticky top-0 z-20 border-b-2 border-sky-100/90 bg-white/88 shadow-[0_12px_40px_-18px_rgba(56,189,248,0.22),0_4px_16px_-8px_rgba(15,23,42,0.06)] backdrop-blur-lg">
                      <div className="flex min-h-[3.75rem] w-full min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:gap-x-4 sm:px-6 md:flex-nowrap md:px-8">
                        {/* Left — mobile menu + date */}
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                          <MobileNav />
                          <HeaderBarDate />
                        </div>

                        {/* Right — search/add + alerts */}
                        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
                          <HeaderActions />
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="shrink-0"
                            aria-label="Notifications"
                          >
                            <BellDot className="size-4 text-sky-600" />
                          </Button>
                        </div>
                      </div>
                    </header>

                    {/* Generous top padding below the sticky header for calmer reading rhythm. */}
                    <main className="flex-1 min-w-0 max-w-full px-4 pb-6 pt-8 sm:px-6 md:px-10 md:pb-8 md:pt-10">
                      {children}
                    </main>
                  </div>
                </div>
              </div>
            </ScheduleDayProvider>
          </GlobalAddPatientProvider>
        </PatientExtrasProvider>
      </AddTaskProvider>
    </TodosProvider>
  )
}
