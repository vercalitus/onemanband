"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { clinicalSources as defaultSources, newsFeed } from "@/lib/mock-data"
import type { ClinicalSource, NewsArticle } from "@/types/domain"

const STORAGE_KEY_SOURCES = "clinical-feed.custom-sources.v1"
const STORAGE_KEY_SAVED = "clinical-feed.saved-ids.v1"

/**
 * Centralised state for the Clinical Feed page.
 *
 * Why a hook (not a context): the feed only lives on one page, so a hook is
 * the lightest way to share state between page + child components without
 * forcing the rest of the app to re-render.
 *
 * Persistence: user-added sources and saved articles are kept in LocalStorage
 * so they survive a refresh. This is intentionally client-only — when we
 * wire up Supabase, the same shape will be loaded from the server in an
 * effect and the LocalStorage layer becomes a hydration cache.
 */
export type ClinicalFeedFilter = string | null

export function useClinicalFeed() {
  const [customSources, setCustomSources] = useState<ClinicalSource[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set())
  const [selectedSourceId, setSelectedSourceId] = useState<ClinicalFeedFilter>(null)
  const [query, setQuery] = useState("")

  // Hydrate persisted state on mount. We do this in an effect (not initialiser)
  // so the first server-render and the first client-render produce the same
  // markup, avoiding hydration mismatches.
  useEffect(() => {
    try {
      const rawSources = window.localStorage.getItem(STORAGE_KEY_SOURCES)
      if (rawSources) {
        const parsed = JSON.parse(rawSources) as ClinicalSource[]
        if (Array.isArray(parsed)) setCustomSources(parsed.filter((s) => s && s.id && s.name))
      }
      const rawSaved = window.localStorage.getItem(STORAGE_KEY_SAVED)
      if (rawSaved) {
        const parsed = JSON.parse(rawSaved) as string[]
        if (Array.isArray(parsed)) setSavedIds(new Set(parsed))
      }
    } catch {
      // LocalStorage can throw in private modes / quota — fail silently and keep defaults.
    }
  }, [])

  // Persist whenever the user mutates the list.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(customSources))
    } catch {}
  }, [customSources])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify([...savedIds]))
    } catch {}
  }, [savedIds])

  const sources = useMemo<ClinicalSource[]>(
    () => [...defaultSources, ...customSources],
    [customSources],
  )

  /** Counts per-source so the sidebar can show a small number next to each. */
  const articleCountBySource = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of newsFeed) counts.set(a.sourceId, (counts.get(a.sourceId) ?? 0) + 1)
    return counts
  }, [])

  const filteredArticles = useMemo<NewsArticle[]>(() => {
    const q = query.trim().toLowerCase()
    return newsFeed.filter((a) => {
      if (selectedSourceId && a.sourceId !== selectedSourceId) return false
      if (!q) return true
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q) ||
        a.keyword.toLowerCase().includes(q)
      )
    })
  }, [query, selectedSourceId])

  const addSource = useCallback((input: { name: string; url?: string }) => {
    const name = input.name.trim()
    if (!name) return
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `src-custom-${crypto.randomUUID().slice(0, 8)}`
        : `src-custom-${Date.now()}`
    setCustomSources((prev) => [
      ...prev,
      { id, name, url: input.url?.trim() || undefined, custom: true },
    ])
  }, [])

  const removeCustomSource = useCallback((id: string) => {
    setCustomSources((prev) => prev.filter((s) => s.id !== id))
    setSelectedSourceId((prev) => (prev === id ? null : prev))
  }, [])

  const toggleSaved = useCallback((articleId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(articleId)) next.delete(articleId)
      else next.add(articleId)
      return next
    })
  }, [])

  const isSaved = useCallback((articleId: string) => savedIds.has(articleId), [savedIds])

  return {
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
    totalCount: newsFeed.length,
  }
}
