"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { navigationIcons, navigationItems } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type SidebarNavListProps = {
  onItemClick?: () => void
}

export function SidebarNavList({ onItemClick }: SidebarNavListProps) {
  const pathname = usePathname()

  return (
    <>
      {navigationItems.map((item) => {
        const Icon = navigationIcons[item.icon]
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "flex w-full items-start gap-3 px-5 py-3.5 transition-colors duration-200",
              isActive
                ? "bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/15"
                : "hover:bg-white/[0.06]",
            )}
          >
            <Icon
              className={cn("mt-0.5 size-4 shrink-0 text-white", isActive ? "text-sky-400" : "text-white/85")}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-[0.01em] text-white">{item.label}</p>
            </div>
            <ChevronRight
              className={cn(
                "ml-auto mt-0.5 size-3.5 shrink-0 transition-transform text-white/50",
                isActive ? "translate-x-0.5 text-sky-400" : "",
              )}
            />
          </Link>
        )
      })}
    </>
  )
}
