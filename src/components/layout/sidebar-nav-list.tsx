"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { navigationIcons, navigationItems } from "@/lib/navigation"
import type { NavItem } from "@/types/domain"
import { cn } from "@/lib/utils"

type SidebarNavListProps = {
  onItemClick?: () => void
}

function SidebarNavLink({
  item,
  pathname,
  onItemClick,
  tier,
}: {
  item: NavItem
  pathname: string
  onItemClick?: () => void
  tier: "primary" | "secondary"
}) {
  const Icon = navigationIcons[item.icon]
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const secondary = tier === "secondary"

  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      className={cn(
        "relative flex w-full items-start gap-3 overflow-visible px-5 transition-colors duration-200",
        secondary ? "py-2.5" : "py-3.5",
        isActive
          ? cn(
              "z-0 bg-sky-400/18",
              /* Inset sky bar + soft glow to the left (no ::before — works reliably across builds). */
              "shadow-[inset_5px_0_0_0_rgb(56_189_248),inset_0_1px_0_rgba(255,255,255,0.07),-6px_0_22px_-10px_rgba(56,189,248,0.42)]",
            )
          : "hover:bg-white/[0.06]",
      )}
    >
      <Icon
        className={cn(
          secondary ? "mt-px size-3.5" : "mt-0.5 size-4",
          "shrink-0",
          isActive ? "text-sky-400" : secondary ? "text-sky-300/55" : "text-sky-200",
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "tracking-[0.01em]",
            secondary
              ? "text-[11px] font-normal leading-snug tracking-wide text-white/55"
              : "text-sm font-semibold text-white",
          )}
        >
          {item.label}
        </p>
      </div>
      <ChevronRight
        className={cn(
          "ml-auto shrink-0 transition-transform text-sky-400/40",
          secondary ? "mt-px size-3" : "mt-0.5 size-3.5",
          isActive && "translate-x-0.5 text-sky-400",
        )}
      />
    </Link>
  )
}

export function SidebarNavList({ onItemClick }: SidebarNavListProps) {
  const pathname = usePathname()
  const primaryItems = navigationItems.filter((i) => i.href !== "/settings")
  const secondaryItems = navigationItems.filter((i) => i.href === "/settings")

  return (
    <>
      {primaryItems.map((item) => (
        <SidebarNavLink key={item.href} item={item} pathname={pathname} onItemClick={onItemClick} tier="primary" />
      ))}
      {secondaryItems.length > 0 ? (
        <div className="mt-2 border-t border-white/[0.08] pt-1">
          {secondaryItems.map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} onItemClick={onItemClick} tier="secondary" />
          ))}
        </div>
      ) : null}
    </>
  )
}
