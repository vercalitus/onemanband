import { Settings2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { getNavItemByHref, navBadgeCaption } from "@/lib/navigation"

export default function SettingsPage() {
  const nav = getNavItemByHref("/settings")!

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mt-4 flex flex-col gap-4 sm:mt-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            {navBadgeCaption(nav.description)}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">{nav.label}</h1>
        </div>
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
