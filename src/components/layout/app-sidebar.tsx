"use client"

import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { useClinicProfile } from "@/components/layout/use-clinic-profile"
import { useLocale } from "@/components/providers/locale-provider"

/**
 * The rail: the upright half of the cobalt L (the plate across the top is the
 * other half — see DESIGN.md). Narrow on purpose. It used to be a 288px panel
 * with a tagline and a decorative skeleton, which on an iPad in landscape cost
 * a quarter of the width the chart needs.
 */
export function AppSidebar() {
  const profile = useClinicProfile()
  const { t } = useLocale()
  const name = profile.clinicName || t("mobile.menuTitle")

  return (
    <aside className="on-cobalt sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col items-center bg-cobalt py-3 text-white md:flex border-e border-white/25">
      <div
        className="mb-3 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-white font-display text-[22px] leading-none"
        title={name}
      >
        {profile.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-provided data URL from settings
          <img src={profile.logoDataUrl} alt={name} className="size-full object-cover" />
        ) : (
          <span aria-label={name}>ob</span>
        )}
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-1" aria-label={t("mobile.drawerAria")}>
        <SidebarNavList variant="rail" />
      </nav>
    </aside>
  )
}
