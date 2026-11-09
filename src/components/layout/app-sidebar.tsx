"use client"

import { HeaderActions } from "@/components/layout/header-actions"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { SidebarNavList } from "@/components/layout/sidebar-nav-list"
import { SignOutButton } from "@/components/layout/sign-out-button"
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

      {/* Search and add sit above the sections: they are tools for every
          screen, and up here they leave the plate to the page's facts. */}
      <HeaderActions variant="rail" />
      <span className="my-2 h-px w-12 bg-white/25" aria-hidden />

      <nav className="flex w-full flex-1 flex-col items-center gap-1" aria-label={t("mobile.drawerAria")}>
        <SidebarNavList variant="rail" />
      </nav>

      <div className="mt-1 flex flex-col items-center gap-1">
        <LocaleSwitcher variant="rail" />
        <SignOutButton variant="rail" />
      </div>
    </aside>
  )
}
