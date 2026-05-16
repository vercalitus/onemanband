"use client"

import { Stethoscope } from "lucide-react"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { useClinicProfile } from "@/components/layout/use-clinic-profile"

function SidebarMark() {
  return (
    // Static asset: avoid next/image + sharp on the server (host-specific 500s).
    // eslint-disable-next-line @next/next/no-img-element -- intentional
    <img
      src="/bones.png"
      alt=""
      className="block h-auto w-full max-w-full object-contain"
    />
  )
}

export function AppSidebar() {
  const profile = useClinicProfile()

  return (
    <aside className="hidden w-72 flex-shrink-0 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-5 py-6 text-slate-200 lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/5 text-sky-400">
          {profile.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-provided data URL from settings
            <img src={profile.logoDataUrl} alt="" className="size-full object-cover" />
          ) : (
            <Stethoscope className="size-4.5 stroke-[1.75]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[0.01em] text-white">
            {profile.clinicName || "Your clinic"}
          </p>
          <p className="text-xs text-sky-300/90">Medical OS</p>
        </div>
      </div>

      <nav className="mt-6 -mx-5 mb-8 flex flex-col gap-1">
        <SidebarNavList />
      </nav>

      <div className="mt-auto w-full opacity-[0.72]">
        <SidebarMark />
      </div>
    </aside>
  )
}
