"use client"

import { useMemo } from "react"
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { localeToBcp47 } from "@/lib/format-locale"
import { cn } from "@/lib/utils"
import type { NewsArticle } from "@/types/domain"

/**
 * One article as a row of a reading list: where it is from and when, the
 * headline, a few lines of summary. The whole row opens the article; the
 * bookmark sits above that link so saving never navigates away.
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
  const { locale, t } = useLocale()

  const formattedDate = useMemo(() => {
    try {
      const [y, m, d] = article.publishedAt.split("-").map(Number)
      return new Intl.DateTimeFormat(localeToBcp47(locale), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(y, (m ?? 1) - 1, d ?? 1))
    } catch {
      return article.publishedAt
    }
  }, [locale, article.publishedAt])

  return (
    <article className="group relative flex gap-3 px-4 py-5 transition-colors hover:bg-ground sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-mute">
          <span className="font-medium text-ink">{article.source}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt} className="tabular-nums">
            {formattedDate}
          </time>
          {typeof article.readingMinutes === "number" ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("clinical.card.minRead", { n: article.readingMinutes })}</span>
            </>
          ) : null}
        </p>

        <h3 className="mt-1.5 max-w-[60ch] text-[17px] leading-snug font-bold text-ink sm:text-[22px] sm:leading-tight">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="decoration-1 underline-offset-4 outline-none group-hover:underline before:absolute before:inset-0 before:content-[''] focus-visible:before:outline-3 focus-visible:before:-outline-offset-3 focus-visible:before:outline-cobalt"
          >
            {article.title}
            <ExternalLink
              className="ms-1.5 inline-block size-4 -translate-y-0.5 align-middle text-mute rtl:-scale-x-100"
              aria-hidden
            />
          </a>
        </h3>

        <p className="mt-2 line-clamp-3 max-w-[68ch] text-[17px] leading-relaxed text-mute">{article.summary}</p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleSaved()
        }}
        aria-label={saved ? t("clinical.card.saved") : t("clinical.card.save")}
        aria-pressed={saved}
        className={cn(
          "relative z-10 -me-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-sunk",
          saved ? "text-cobalt" : "text-mute hover:text-ink",
        )}
      >
        {saved ? (
          <BookmarkCheck className="size-5 fill-cobalt-tint stroke-[1.75]" aria-hidden />
        ) : (
          <Bookmark className="size-5 stroke-[1.75]" aria-hidden />
        )}
      </button>
    </article>
  )
}
