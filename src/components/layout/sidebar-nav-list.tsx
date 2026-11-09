"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useLocale } from "@/components/providers/locale-provider"
import { navigationIcons, navigationItems } from "@/lib/navigation"
import type { NavItem } from "@/types/domain"
import { cn } from "@/lib/utils"

function navKeyForHref(href: string) {
  switch (href) {
    case "/dashboard":
      return "nav.dashboard"
    case "/patients":
      return "nav.patients"
    case "/calendar":
      return "nav.calendar"
    case "/finances":
      return "nav.finances"
    case "/clinical-feed":
      return "nav.clinicalFeed"
    case "/settings":
      return "nav.settings"
    default:
      return "nav.dashboard"
  }
}

type Variant = "rail" | "drawer"

type SidebarNavListProps = {
  onItemClick?: () => void
  /** `rail`: icon over label in the narrow cobalt rail. `drawer`: a full-width row in the phone menu. */
  variant?: Variant
}

function SidebarNavLink({
  item,
  pathname,
  onItemClick,
  label,
  variant,
}: {
  item: NavItem
  pathname: string
  onItemClick?: () => void
  label: string
  variant: Variant
}) {
  const Icon = navigationIcons[item.icon]
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (variant === "rail") {
    return (
      <Link
        href={item.href}
        onClick={onItemClick}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex min-h-[60px] w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[13px] leading-tight transition-colors",
          isActive ? "bg-ground font-bold text-cobalt" : "text-white/80 hover:bg-white/10 hover:text-white",
        )}
      >
        <Icon className="size-[22px] shrink-0 stroke-[1.75]" aria-hidden />
        <span className="text-balance">{label}</span>
      </Link>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-md px-4 text-[17px] transition-colors",
        isActive ? "bg-ground font-bold text-cobalt" : "text-white/85 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-5 shrink-0 stroke-[1.75]" aria-hidden />
      {label}
    </Link>
  )
}

export function SidebarNavList({ onItemClick, variant = "drawer" }: SidebarNavListProps) {
  const pathname = usePathname()
  const { t } = useLocale()
  const primaryItems = navigationItems.filter((i) => i.href !== "/settings")
  const secondaryItems = navigationItems.filter((i) => i.href === "/settings")

  const render = (item: NavItem) => (
    <SidebarNavLink
      key={item.href}
      item={item}
      pathname={pathname}
      onItemClick={onItemClick}
      label={t(navKeyForHref(item.href))}
      variant={variant}
    />
  )

  return (
    <>
      {primaryItems.map(render)}
      {/* Settings is reached rarely, so it sits apart: at the foot of the
          rail, or under a hairline in the drawer. */}
      <div
        className={cn(
          variant === "rail" ? "mt-auto flex w-full justify-center" : "mt-2 w-full border-t border-white/25 pt-2",
        )}
      >
        {secondaryItems.map(render)}
      </div>
    </>
  )
}
