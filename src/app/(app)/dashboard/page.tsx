import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview"

/** Fresh render on Vercel so dashboard is not served from an outdated static shell. */
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function DashboardPage() {
  return <DashboardOverview />
}
