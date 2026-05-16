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
 * Premium feed card — no surrounding border, soft floating shadow on a slightly
 * darker grid background. Strong text hierarchy: dark source badge → bold
 * heading-font title → 3-line summary → a single muted footer line pinned to
 * the bottom. The card is a single anchor so a click anywhere opens the
 * article in a new tab; the bookmark button stops propagation.
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
        // Equal-height tiles on the grid keep visual rhythm even when summaries are short.
        "group relative flex h-full min-h-[230px] flex-col gap-3 rounded-2xl bg-white p-5",
        "shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)] ring-1 ring-transparent transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.35)] hover:ring-sky-200",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex max-w-[80%] items-center rounded-md bg-slate-900 px-2 py-0.5",
            "text-[10px] font-bold uppercase tracking-[0.12em] text-white",
          )}
          title={article.source}
        >
          <span className="truncate">{article.source}</span>
        </span>

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
            "relative z-10 -mr-1 -mt-1 shrink-0 rounded-lg p-1.5 transition-colors",
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

      <h3 className="font-heading text-[18px] font-bold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-sky-900">
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

      <footer
        className={cn(
          "mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3",
          "text-[11px] text-slate-400",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          {typeof article.readingMinutes === "number" ? (
            <>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span>{article.readingMinutes} min read</span>
            </>
          ) : null}
        </span>
        <span className="relative z-10 inline-flex shrink-0 items-center gap-1 text-slate-400 transition-colors group-hover:text-sky-600">
          Read
          <ExternalLink className="size-3 stroke-[2]" aria-hidden />
        </span>
      </footer>
    </article>
  )
}
