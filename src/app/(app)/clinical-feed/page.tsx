"use client"

import { useState } from "react"
import { Library, Newspaper, Plus, Search } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    showSavedOnly,
    selectSavedOnly,
    selectAllSources,
    selectSource,
    savedCount,
    query,
    setQuery,
    addSource,
    removeCustomSource,
    toggleSaved,
    isSaved,
    totalCount,
  } = useClinicalFeed()

  const [addOpen, setAddOpen] = useState(false)

  const selectedSource = selectedSourceId ? sources.find((s) => s.id === selectedSourceId) ?? null : null

  const headerTitle = showSavedOnly
    ? "Saved articles"
    : selectedSource
      ? selectedSource.name
      : "Clinical Feed"

  const subtitle = (() => {
    if (showSavedOnly)
      return savedCount === 0
        ? "No bookmarks yet"
        : filteredArticles.length === 0 && query.trim()
          ? `No bookmarks match "${query.trim()}"`
          : filteredArticles.length === 1
            ? "1 saved article"
            : `${filteredArticles.length} saved articles`
    if (filteredArticles.length === 0) return query.trim() ? "No matching articles" : "No articles"
    if (filteredArticles.length === 1) return "1 article"
    return `${filteredArticles.length} articles${selectedSource ? "" : " · all sources"}`
  })()

  function clearFilters() {
    setQuery("")
    selectAllSources()
  }

  const emptyMessage = (() => {
    if (showSavedOnly && savedCount === 0 && !query.trim()) {
      return "You haven’t saved any articles yet. Tap the bookmark icon on a card to add it."
    }
    if (showSavedOnly && savedCount > 0 && filteredArticles.length === 0 && query.trim()) {
      return `Nothing in your bookmarks matches “${query.trim()}”.`
    }
    if (query.trim()) return `Nothing found for “${query.trim()}”.`
    return showSavedOnly ? "No saved articles match the current filters." : "No articles to show. Try a different source."
  })()

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
      <aside className="space-y-4">
        <Card className={elevatedCardClass}>
          {/* Grid header: CardAction lands in column 2, same row as the title */}
          <CardHeader className={cn(darkCardHeaderClass, "gap-2 py-3")}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Library className="size-5 shrink-0 stroke-[1.6] text-sky-400" aria-hidden />
              <CardTitle className="text-base font-bold tracking-tight text-white">Sources</CardTitle>
            </div>
            <CardAction>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label="Add source"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/70 bg-transparent px-2.5 py-1",
                  "text-xs font-semibold text-white transition-colors hover:border-white hover:bg-white/10",
                )}
              >
                <Plus className="size-3.5 stroke-[2.2]" aria-hidden />
                Add
              </button>
            </CardAction>
          </CardHeader>

          <CardContent className={cn(elevatedCardBodyClass, "py-3")}>
            <SourceList
              sources={sources}
              articleCountBySource={articleCountBySource}
              totalCount={totalCount}
              selectedSourceId={selectedSourceId}
              showSavedOnly={showSavedOnly}
              savedCount={savedCount}
              onSelectSaved={selectSavedOnly}
              onSelectAllSources={selectAllSources}
              onSelectSource={selectSource}
              onRemoveCustom={removeCustomSource}
            />
          </CardContent>
        </Card>
      </aside>

      <section className="min-w-0">
        <Card className={elevatedCardClass}>
          <CardHeader className={cn(darkCardHeaderClass, "flex-col gap-3 py-4")}>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Newspaper className="size-5 shrink-0 stroke-[1.6] text-sky-400" aria-hidden />
                  <CardTitle className="truncate text-xl font-bold tracking-tight text-white">{headerTitle}</CardTitle>
                </div>
                <span className="text-xs font-medium text-white/60 sm:truncate">{subtitle}</span>
              </div>

              <div className="relative w-full sm:w-[min(100%,18rem)]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles"
                  className={cn(
                    "h-9 rounded-xl border border-white bg-transparent pl-9 text-sm text-white shadow-none",
                    "placeholder:text-white/60",
                    "focus-visible:border-white focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent",
                  )}
                  aria-label="Search articles"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn(elevatedCardBodyClass, "bg-slate-50/60 py-6")}>
            {filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">{emptyMessage}</p>
                {(query.trim() || selectedSourceId || showSavedOnly) && (
                  <button
                    type="button"
                    onClick={clearFilters}
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
