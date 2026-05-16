"use client"

import { useState } from "react"
import { Library, Newspaper, Plus, Search } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AddSourceDialog } from "@/features/clinical-feed/components/add-source-dialog"
import { FeedCard } from "@/features/clinical-feed/components/feed-card"
import { SourceList } from "@/features/clinical-feed/components/source-list"
import { useClinicalFeed } from "@/features/clinical-feed/lib/use-clinical-feed"
import {
  darkCardHeaderClass,
  elevatedCardBodyClass,
  elevatedCardClass,
} from "@/lib/clinic-card-styles"
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

  const headerTitle = selectedSource ? selectedSource.name : "Clinical Feed"

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
      {/* Sources sidebar */}
      <aside className="space-y-4">
        <Card className={elevatedCardClass}>
          <CardHeader className={cn(darkCardHeaderClass, "flex-row items-center justify-between gap-3")}>
            <div className="flex items-center gap-2.5">
              <Library className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
              <CardTitle className="text-base font-bold tracking-tight text-white">Sources</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label="Add source"
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1",
                "text-xs font-semibold text-white/90 transition-colors hover:bg-white/10",
              )}
            >
              <Plus className="size-3.5 stroke-[2.2]" aria-hidden />
              Add
            </button>
          </CardHeader>

          <CardContent className={cn(elevatedCardBodyClass, "py-4")}>
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
          <CardHeader className={cn(darkCardHeaderClass, "flex-col gap-3")}>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Newspaper className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
                <CardTitle className="truncate text-xl font-bold tracking-tight text-white">
                  {headerTitle}
                </CardTitle>
                <span className="hidden text-xs font-medium text-white/50 sm:inline">
                  {filteredArticles.length === 0
                    ? "No results"
                    : filteredArticles.length === 1
                      ? "1 article"
                      : `${filteredArticles.length} articles`}
                  {selectedSource ? null : " · all sources"}
                </span>
              </div>

              <div className="relative w-full sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles"
                  className={cn(
                    "h-9 rounded-xl border-white/15 bg-white/10 pl-9 text-sm text-white",
                    "placeholder:text-white/40 focus-visible:border-sky-400 focus-visible:bg-white/15",
                  )}
                  aria-label="Search articles"
                />
              </div>
            </div>
          </CardHeader>

          {/* Slightly darker page surface so the white cards "float". */}
          <CardContent className={cn(elevatedCardBodyClass, "bg-slate-50/60 py-6")}>
            {filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
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
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
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
