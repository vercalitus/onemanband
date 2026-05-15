import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview"

/** Fresh render on Vercel so dashboard is not served from an outdated static shell. */
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function DashboardPage() {
  const scheduleDateCaption = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return <DashboardOverview scheduleDateCaption={scheduleDateCaption} />
}
