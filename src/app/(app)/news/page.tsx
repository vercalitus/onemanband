import Link from "next/link"
import { Newspaper } from "lucide-react"

import { newsFeed } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { getNavItemByHref, navBadgeCaption } from "@/lib/navigation"

export default function ClinicalFeedPage() {
  const nav = getNavItemByHref("/news")!

  return (
    <div className="space-y-8">
      <section className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            {navBadgeCaption(nav.description)}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-slate-900">{nav.label}</h1>
        </div>
        <div className="inline-flex items-center rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.08)]">
          Curated clinical updates
        </div>
      </section>

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Newspaper className="size-5 stroke-[1.6] text-sky-400" />
            <CardTitle className="text-xl font-bold tracking-tight text-white">Professional Updates</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={`${elevatedCardBodyClass} space-y-4`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input placeholder='Filter by keyword, e.g. "Cervical Spine"' className="lg:max-w-md" />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                Cervical Spine
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                Lumbar
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                Insurance
              </Badge>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {newsFeed.map((article) => (
              <Card key={article.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40 shadow-none">
                <CardHeader>
                  <Badge variant="outline" className="w-fit border-slate-200 bg-white text-slate-600">
                    {article.keyword}
                  </Badge>
                  <CardTitle className="mt-2 text-lg text-slate-900">{article.title}</CardTitle>
                  <CardDescription>
                    {article.source} · {article.publishedAt}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-slate-500">
                  <p>{article.summary}</p>
                  <Link href={article.url} className="font-medium text-slate-900 transition-colors hover:text-slate-700">
                    Open source article
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
