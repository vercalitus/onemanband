"use client"

import { useMemo, useState } from "react"
import { Library, Newspaper, Plus, Search } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
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
import { localizeNewsArticle } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"

export default function ClinicalFeedPage() {
  const { locale, t } = useLocale()
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

  const articlesForLocale = useMemo(
    () => filteredArticles.map((a) => localizeNewsArticle(a, locale)),
    [filteredArticles, locale],
  )

  const headerTitle = showSavedOnly
    ? t("clinical.title.saved")
    : selectedSource
      ? selectedSource.name
      : t("clinical.title.feed")

  const subtitle = useMemo(() => {
    const q = query.trim()
    if (showSavedOnly) {
      if (savedCount === 0) return t("clinical.subtitle.savedNone")
      if (filteredArticles.length === 0 && q) return t("clinical.subtitle.savedNoMatch", { q })
      if (filteredArticles.length === 1) return t("clinical.subtitle.savedOne")
      return t("clinical.subtitle.savedMany", { n: filteredArticles.length })
    }
    if (filteredArticles.length === 0) return q ? t("clinical.subtitle.noneQuery") : t("clinical.subtitle.none")
    if (filteredArticles.length === 1) return t("clinical.subtitle.one")
    return selectedSource
      ? t("clinical.subtitle.many", { n: filteredArticles.length })
      : t("clinical.subtitle.manyAllSources", { n: filteredArticles.length })
  }, [
    showSavedOnly,
    savedCount,
    filteredArticles.length,
    query,
    selectedSource,
    t,
  ])

  const emptyMessage = useMemo(() => {
    const q = query.trim()
    if (showSavedOnly && savedCount === 0 && !q) return t("clinical.empty.savedIntro")
    if (showSavedOnly && savedCount > 0 && filteredArticles.length === 0 && q) {
      return t("clinical.empty.savedNoMatchBookmarks", { q })
    }
    if (q) return t("clinical.empty.noQueryResults", { q })
    return showSavedOnly ? t("clinical.empty.savedFiltered") : t("clinical.empty.trySource")
  }, [showSavedOnly, savedCount, filteredArticles.length, query, t])

  function clearFilters() {
    setQuery("")
    selectAllSources()
  }

  return (
    <div className="grid gap-6 md:gap-8 xl:grid-cols-[260px_1fr]">
      <aside className="space-y-4">
        <Card className={elevatedCardClass}>
          <CardHeader className={cn(darkCardHeaderClass, "gap-2 py-3")}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Library className="size-5 shrink-0 stroke-[1.6] text-sky-400" aria-hidden />
              <CardTitle className="text-base font-bold tracking-tight text-white">{t("clinical.sourcesTitle")}</CardTitle>
            </div>
            <CardAction>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label={t("clinical.addSourceAria")}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/70 bg-transparent px-2.5 py-1",
                  "text-xs font-semibold text-white transition-colors hover:border-white hover:bg-white/10",
                )}
              >
                <Plus className="size-3.5 stroke-[2.2]" aria-hidden />
                {t("clinical.addShort")}
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
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-white/60"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("clinical.search.placeholder")}
                  className={cn(
                    "h-9 rounded-xl border border-white bg-transparent ps-9 text-sm text-white shadow-none",
                    "placeholder:text-white/60",
                    "focus-visible:border-white focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent",
                  )}
                  aria-label={t("clinical.search.placeholder")}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn(elevatedCardBodyClass, "bg-slate-50/60 py-6")}>
            {articlesForLocale.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">{emptyMessage}</p>
                {(query.trim() || selectedSourceId || showSavedOnly) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    {t("clinical.clearFilters")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 sm:gap-7 xl:grid-cols-3 xl:gap-8">
                {articlesForLocale.map((article) => (
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
