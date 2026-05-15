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
              "z-0 bg-white/[0.11] shadow-[inset_4px_0_0_0_rgb(56_189_248),inset_0_1px_0_rgba(255,255,255,0.06)]",
              secondary
                ? "before:inset-y-2 before:shadow-[0_0_12px_6px_rgba(56,189,248,0.26)]"
                : "before:inset-y-2.5 before:shadow-[0_0_14px_8px_rgba(56,189,248,0.3)]",
              "before:pointer-events-none before:absolute before:left-0 before:z-10 before:w-[3px] before:rounded-full before:bg-sky-400 before:opacity-95 before:content-['']",
            )
          : "hover:bg-white/[0.06]",
      )}
    >
      <Icon
        className={cn(
          secondary ? "mt-px size-3.5" : "mt-0.5 size-4",
          "shrink-0",
          isActive ? "text-sky-400" : secondary ? "text-white/65" : "text-white/85",
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "tracking-[0.01em]",
            secondary
              ? "text-xs font-medium leading-snug text-white/75"
              : "text-sm font-semibold text-white",
          )}
        >
          {item.label}
        </p>
      </div>
      <ChevronRight
        className={cn(
          "ml-auto shrink-0 transition-transform text-white/50",
          secondary ? "mt-px size-3" : "mt-0.5 size-3.5",
          isActive ? "translate-x-0.5 text-sky-400" : "",
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
