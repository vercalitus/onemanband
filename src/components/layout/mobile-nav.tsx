"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Menu, Stethoscope } from "lucide-react"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/providers/locale-provider"

/**
 * Mobile / tablet navigation drawer. The overlay must render via a portal to
 * `document.body`: the app header uses `backdrop-blur`, which establishes a
 * containing block for `position: fixed` descendants, so an in-tree fixed
 * layer gets clipped and sits under the main column. Portaling + a high
 * z-index keeps the sheet above all in-app chrome (headers, bottom bars, z-50 UIs).
 */
export function MobileNav() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const drawer = open ? (
    <div
      className="fixed inset-0 z-[300] lg:hidden"
      id="mobile-app-nav"
      role="dialog"
      aria-modal="true"
      aria-label={t("mobile.drawerAria")}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
        aria-label={t("mobile.closeOverlay")}
        onClick={() => setOpen(false)}
      />
      <aside
        className="relative z-10 flex h-full w-72 max-w-[min(100vw-2rem,18rem)] flex-col overflow-y-auto overscroll-contain border-r border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sky-400">
            <Stethoscope className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.01em] text-white">{t("mobile.clinicName")}</p>
            <p className="text-xs text-sky-300/90">{t("mobile.clinicSubtitle")}</p>
          </div>
        </div>

        <nav className="mt-6 -mx-5 flex flex-col gap-1">
          <SidebarNavList onItemClick={() => setOpen(false)} />
        </nav>
      </aside>
    </div>
  ) : null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 border-slate-200 text-sky-700 shadow-none lg:hidden"
        aria-label={t("header.openMenu")}
        aria-expanded={open}
        aria-controls="mobile-app-nav"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
      </Button>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  )
}
