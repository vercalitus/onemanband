import { BellDot } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderBarDate } from "@/components/layout/header-bar-date"
import { HeaderActions } from "@/components/layout/header-actions"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AddTaskProvider } from "@/components/providers/add-task-provider"
import { Button } from "@/components/ui/button"
import { PatientExtrasProvider } from "@/components/providers/patient-extras-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AddTaskProvider>
      <PatientExtrasProvider>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="mx-auto flex min-h-screen min-w-0 max-w-[1680px]">
          <AppSidebar />

          <div className="relative flex min-h-screen min-w-0 max-w-full flex-1 flex-col bg-[#F8FAFC] shadow-[-8px_0_20px_-10px_rgba(15,23,42,0.07)]">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            <div className="flex min-h-14 w-full min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 py-2 px-4 sm:gap-x-4 sm:px-6 md:flex-nowrap md:px-8">
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
                  className="shrink-0 border-slate-100 bg-white shadow-none"
                  aria-label="Notifications"
                >
                  <BellDot className="size-4 text-sky-600" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 min-w-0 max-w-full px-4 py-5 sm:px-6 md:px-8">{children}</main>
          </div>
        </div>
      </div>
      </PatientExtrasProvider>
    </AddTaskProvider>
  )
}
