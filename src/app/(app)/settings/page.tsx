import { Settings2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { getNavItemByHref } from "@/lib/navigation"

export default function SettingsPage() {
  const nav = getNavItemByHref("/settings")!

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mb-1">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">{nav.label}</h1>
      </section>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Settings2 className="size-5 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-xl font-bold tracking-tight text-white">Practice settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={`${elevatedCardBodyClass} space-y-2`}>
          <CardDescription className="text-base text-slate-600">
            Profile, integrations, and notifications will live here. This area is not wired yet.
          </CardDescription>
          <p className="text-sm font-medium text-slate-500">Coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
