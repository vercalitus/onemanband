"use client"

import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"
import type { NewsArticle } from "@/types/domain"

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function formatDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number)
    return DATE_FMT.format(new Date(y, (m ?? 1) - 1, d ?? 1))
  } catch {
    return iso
  }
}

/**
 * Premium feed card — typography-first (no badges/bubbles). The whole card is
 * a single anchor so a click anywhere opens the article in a new tab. The
 * bookmark button stops propagation so users can save without navigating.
 */
export function FeedCard({
  article,
  saved,
  onToggleSaved,
}: {
  article: NewsArticle
  saved: boolean
  onToggleSaved: () => void
}) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_18px_44px_-28px_rgba(15,23,42,0.35)]",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
          <span>{article.source}</span>
          {typeof article.readingMinutes === "number" ? (
            <>
              <span className="mx-1.5 text-slate-300" aria-hidden>
                ·
              </span>
              <span className="text-slate-500">{article.readingMinutes} min read</span>
            </>
          ) : null}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleSaved()
          }}
          aria-label={saved ? "Remove from saved" : "Save for later"}
          aria-pressed={saved}
          className={cn(
            "-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 transition-colors",
            saved
              ? "text-sky-600 hover:bg-sky-50"
              : "text-slate-300 hover:bg-slate-50 hover:text-sky-600",
          )}
        >
          {saved ? (
            <BookmarkCheck className="size-4 stroke-[1.8]" aria-hidden />
          ) : (
            <Bookmark className="size-4 stroke-[1.8]" aria-hidden />
          )}
        </button>
      </header>

      <h3 className="font-heading text-[17px] font-semibold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-sky-900">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="before:absolute before:inset-0 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:rounded-2xl"
        >
          {article.title}
        </a>
      </h3>

      <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{article.summary}</p>

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1 text-[12px] text-slate-400">
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        <span className="relative z-10 inline-flex items-center gap-1 text-slate-400 transition-colors group-hover:text-sky-600">
          Read
          <ExternalLink className="size-3 stroke-[2]" aria-hidden />
        </span>
      </footer>
    </article>
  )
}
