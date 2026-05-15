"use client"

import { useEffect, useState } from "react"
import { Menu, Stethoscope } from "lucide-react"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { Button } from "@/components/ui/button"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 border-slate-200 text-sky-700 shadow-none lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-app-nav"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" id="mobile-app-nav" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[min(100vw-2rem,18rem)] flex-col border-r border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-5 py-6 text-slate-200 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sky-400">
                <Stethoscope className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.01em] text-white">Serene Spine Clinic</p>
                <p className="text-xs text-sky-300/90">Medical OS</p>
              </div>
            </div>

            <nav className="mt-6 -mx-5 flex flex-col gap-1">
              <SidebarNavList onItemClick={() => setOpen(false)} />
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  )
}
