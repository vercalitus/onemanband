import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview"

export default function DashboardPage() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)

  return (
    <div>
      {sha ? (
        <p className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-[11px] text-slate-600 tabular-nums shadow-sm">
          Live deploy: <span className="font-semibold text-slate-900">{sha}</span>
        </p>
      ) : null}
      <DashboardOverview />
    </div>
  )
}
