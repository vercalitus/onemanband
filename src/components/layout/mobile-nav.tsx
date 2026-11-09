"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Menu } from "lucide-react"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { useClinicProfile } from "@/components/layout/use-clinic-profile"
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
  const profile = useClinicProfile()
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
      className="fixed inset-0 z-[300] md:hidden"
      id="mobile-app-nav"
      role="dialog"
      aria-modal="true"
      aria-label={t("mobile.drawerAria")}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(14_22_42/0.52)]"
        aria-label={t("mobile.closeOverlay")}
        onClick={() => setOpen(false)}
      />
      <aside
        className="on-cobalt relative z-10 flex h-full w-72 max-w-[min(100vw-2rem,18rem)] flex-col overflow-y-auto overscroll-contain bg-cobalt px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border-2 border-white font-display text-[22px] leading-none" aria-hidden>
            ob
          </div>
          <div>
            {/* The clinic's own name, like the desktop sidebar. This was a
                translation string, so a real practice's phone menu carried the
                demo clinic's name in whatever language it was opened in. */}
            <p className="text-[17px] font-bold text-white">
              {profile.clinicName || t("mobile.menuTitle")}
            </p>
            <p className="text-sm text-white/80">{t("mobile.clinicSubtitle")}</p>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
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
        className="size-11 shrink-0 rounded-md border-white/25 bg-transparent text-white shadow-none hover:bg-white/10 hover:text-white md:hidden"
        aria-label={t("header.openMenu")}
        aria-expanded={open}
        aria-controls="mobile-app-nav"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  )
}
