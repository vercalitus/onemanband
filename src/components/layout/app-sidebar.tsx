"use client"

import { Stethoscope } from "lucide-react"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { Separator } from "@/components/ui/separator"

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
  return (
    <aside className="hidden w-72 flex-shrink-0 flex-col bg-[#F0F9FF] px-5 py-6 text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-500">
          <Stethoscope className="size-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.01em] text-sky-900">Serene Spine Clinic</p>
          <p className="text-xs text-sky-400">Medical OS</p>
        </div>
      </div>

      <nav className="mt-6 -mx-5 flex flex-col gap-1">
        <SidebarNavList />
      </nav>

      <Separator className="my-6 bg-sky-100" />

      <div className="mt-auto w-full">
        <SidebarMark />
      </div>
    </aside>
  )
}
