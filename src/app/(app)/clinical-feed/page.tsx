"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AddSourceDialog } from "@/features/clinical-feed/components/add-source-dialog"
import { FeedCard } from "@/features/clinical-feed/components/feed-card"
import { SourceList } from "@/features/clinical-feed/components/source-list"
import { useClinicalFeed } from "@/features/clinical-feed/lib/use-clinical-feed"
import { elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { cn } from "@/lib/utils"

export default function ClinicalFeedPage() {
  const {
    sources,
    articleCountBySource,
    filteredArticles,
    selectedSourceId,
    setSelectedSourceId,
    query,
    setQuery,
    addSource,
    removeCustomSource,
    toggleSaved,
    isSaved,
    totalCount,
  } = useClinicalFeed()

  const [addOpen, setAddOpen] = useState(false)

  const selectedSource = selectedSourceId
    ? sources.find((s) => s.id === selectedSourceId) ?? null
    : null

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
      {/* Sources sidebar */}
      <aside className="space-y-4">
        <Card className={elevatedCardClass}>
          <CardContent className={cn(elevatedCardBodyClass, "py-5")}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Sources
              </h2>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label="Add source"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
              >
                <Plus className="size-3.5 stroke-[2]" aria-hidden />
                Add
              </button>
            </div>

            <SourceList
              sources={sources}
              articleCountBySource={articleCountBySource}
              totalCount={totalCount}
              selectedSourceId={selectedSourceId}
              onSelect={setSelectedSourceId}
              onRemoveCustom={removeCustomSource}
            />
          </CardContent>
        </Card>
      </aside>

      {/* Feed */}
      <section className="min-w-0">
        <Card className={elevatedCardClass}>
          <CardContent className={cn(elevatedCardBodyClass, "space-y-5 py-6")}>
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-heading text-xl font-semibold tracking-tight text-slate-900">
                  {selectedSource ? selectedSource.name : "Clinical Feed"}
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {filteredArticles.length === 0
                    ? "No articles match the current filter."
                    : filteredArticles.length === 1
                      ? "1 article"
                      : `${filteredArticles.length} articles`}
                  {selectedSource ? null : " across all sources"}
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles"
                  className="h-10 rounded-xl border-slate-200 bg-slate-50/60 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white"
                  aria-label="Search articles"
                />
              </div>
            </header>

            {filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
                <p className="text-sm text-slate-500">
                  {query.trim()
                    ? `Nothing found for “${query.trim()}”.`
                    : "No articles to show. Try a different source."}
                </p>
                {(query.trim() || selectedSourceId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setSelectedSourceId(null)
                    }}
                    className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredArticles.map((article) => (
                  <FeedCard
                    key={article.id}
                    article={article}
                    saved={isSaved(article.id)}
                    onToggleSaved={() => toggleSaved(article.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} onSave={addSource} />
    </div>
  )
}
