"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"

import { PagePlate, PlateDivider, PlateLabel } from "@/components/layout/page-plate"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddSourceDialog } from "@/features/clinical-feed/components/add-source-dialog"
import { FeedCard } from "@/features/clinical-feed/components/feed-card"
import { SourceList } from "@/features/clinical-feed/components/source-list"
import { useClinicalFeed } from "@/features/clinical-feed/lib/use-clinical-feed"

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
  } = useClinicalFeed(locale)

  const [addOpen, setAddOpen] = useState(false)

  const selectedSource = selectedSourceId ? sources.find((s) => s.id === selectedSourceId) ?? null : null

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

  const sourceListProps = {
    sources,
    articleCountBySource,
    totalCount,
    selectedSourceId,
    showSavedOnly,
    savedCount,
    onSelectSaved: selectSavedOnly,
    onSelectAllSources: selectAllSources,
    onSelectSource: selectSource,
    onRemoveCustom: removeCustomSource,
  }

  const addSourceButton = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setAddOpen(true)}
      aria-label={t("clinical.addSourceAria")}
      className="gap-2 text-sm"
    >
      <Plus className="size-4" aria-hidden />
      {t("clinical.addShort")}
    </Button>
  )

  return (
    <div className="mx-auto grid max-w-[1120px] gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <PagePlate>
        <div className="flex min-w-0 flex-col">
          {/* Which feed this is, when the title names a source or the saved list. */}
          {headerTitle !== t("clinical.title.feed") ? <PlateLabel>{t("clinical.title.feed")}</PlateLabel> : null}
          <h1 className="mt-0.5 truncate font-display text-[40px] leading-[0.95] text-white sm:text-[56px]">
            {headerTitle}
          </h1>
        </div>
        <PlateDivider />
        <p className="max-w-[260px] text-sm leading-snug text-white/80">{subtitle}</p>
      </PagePlate>

      {/* Sources: their own column beside the list on a wide screen, a line
          of chips above it on a narrow one. */}
      <aside className="hidden lg:block">
        <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-mute">{t("clinical.sourcesTitle")}</h2>
          {addSourceButton}
        </div>
        <SourceList {...sourceListProps} />
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-mute"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("clinical.search.placeholder")}
              className="border-hair ps-9"
              aria-label={t("clinical.search.placeholder")}
            />
          </div>
          <div className="lg:hidden">{addSourceButton}</div>
        </div>

        <div className="lg:hidden">
          <SourceList {...sourceListProps} layout="row" />
        </div>

        {filteredArticles.length === 0 ? (
          <div className="rounded-md border border-hair bg-paper px-6 py-12 text-center">
            <p className="text-[17px] text-mute">{emptyMessage}</p>
            {(query.trim() || selectedSourceId || showSavedOnly) && (
              <Button type="button" variant="link" onClick={clearFilters} className="mt-2">
                {t("clinical.clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-hair-soft rounded-md border border-hair bg-paper">
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
      </section>

      <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} onSave={addSource} />
    </div>
  )
}
