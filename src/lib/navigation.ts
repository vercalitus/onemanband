import { Activity, CalendarDays, LayoutDashboard, Newspaper, Settings2, Wallet } from "lucide-react"

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
    label: "Billing",
    icon: "Wallet",
    description: "Invoices, debtors, and revenue",
  },
  {
    href: "/news",
    label: "Clinical Feed",
    icon: "Newspaper",
    description: "Clinical headlines and curated keywords",
  },
  {
    href: "/settings",
    label: "My Settings",
    icon: "Settings2",
    description: "Practice profile and integrations — coming soon",
  },
]

export const navigationIcons: Record<string, LucideIcon> = {
  LayoutDashboard,
  Activity,
  CalendarDays,
  Wallet,
  Newspaper,
  Settings2,
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
