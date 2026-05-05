"use client"

import { Bell, Stethoscope } from "lucide-react"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { Badge } from "@/components/ui/badge"
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

      <div className="w-full">
        <SidebarMark />
      </div>

      <div className="mt-auto rounded-2xl border border-sky-100 bg-white/60 p-4">
        <div className="flex items-center justify-between text-sm font-medium text-sky-900">
          <div className="inline-flex items-center gap-2">
            <Bell className="size-4 text-sky-400" />
            Automations
          </div>
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-600">
            Queue 3
          </Badge>
        </div>
      </div>
    </aside>
  )
}
