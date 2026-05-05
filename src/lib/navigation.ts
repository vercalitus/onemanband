import { Activity, CalendarDays, LayoutDashboard, Newspaper, Wallet } from "lucide-react"

import type { LucideIcon } from "lucide-react"

import type { NavItem } from "@/types/domain"

export const navigationItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    description: "Operations snapshot and clinic pulse",
  },
  {
    href: "/patients",
    label: "Patients",
    icon: "Activity",
    description: "CRM, records, and notes",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: "CalendarDays",
    description: "Scheduling and Google sync",
  },
  {
    href: "/finances",
    label: "Finances",
    icon: "Wallet",
    description: "Revenue, debtors, and invoices",
  },
  {
    href: "/news",
    label: "News",
    icon: "Newspaper",
    description: "Professional updates and keywords",
  },
]

export const navigationIcons: Record<string, LucideIcon> = {
  LayoutDashboard,
  Activity,
  CalendarDays,
  Wallet,
  Newspaper,
}

export function getNavItemByHref(href: string) {
  return navigationItems.find((item) => item.href === href)
}

/** Short line for the badge under the page title (from nav description). */
export function navBadgeCaption(description: string) {
  const comma = description.indexOf(",")
  if (comma !== -1) return description.slice(0, comma).trim()
  const and = description.indexOf(" and ")
  if (and !== -1) return description.slice(0, and).trim()
  return description
}
