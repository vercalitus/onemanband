"use client"

import { Check, Copy, Lock, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"

/**
 * The practitioner's calendar subscription link.
 *
 * Replaces a switch that claimed to connect Google Calendar and did nothing —
 * it flipped a stored boolean nobody read. A link that works is worth more than
 * a toggle that looks like it does.
 *
 * The link is a secret: whoever holds it can read the clinic's diary, names and
 * times included. It is shown behind the login, said plainly to be private, and
 * replaceable here — which is the whole reason it is worth showing rather than
 * hiding in a deploy.
 */
export function CalendarSubscription() {
  const { t } = useLocale()
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading")
  const [copied, setCopied] = useState(false)
  const [replacing, setReplacing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/subscription", { cache: "no-store" })
      const body = (await res.json()) as { ok: boolean; url?: string }
      if (body.ok && body.url) {
        setUrl(body.url)
        setState("ready")
        return
      }
    } catch {
      /* offline, or no database on this deploy */
    }
    setState("unavailable")
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the field is selectable, which is the fallback */
    }
  }

  const replace = async () => {
    // Irreversible for anyone already subscribed: their calendar simply stops
    // updating, with no error, so it is worth asking first.
    if (!window.confirm(t("settings.calendarFeed.replaceConfirm"))) return
    setReplacing(true)
    try {
      const res = await fetch("/api/calendar/subscription", { method: "POST" })
      const body = (await res.json()) as { ok: boolean; url?: string }
      if (body.ok && body.url) setUrl(body.url)
    } finally {
      setReplacing(false)
    }
  }

  if (state === "unavailable") return null

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-[17px] leading-snug font-medium text-ink">{t("settings.calendarFeed.title")}</p>
        <p className="mt-1 max-w-2xl text-sm leading-snug text-mute">{t("settings.calendarFeed.how")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          dir="ltr"
          value={url ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 basis-64 rounded-md border border-hair bg-ground px-3 font-mono text-sm text-ink outline-none focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/20"
          aria-label={t("settings.calendarFeed.title")}
        />
        <Button type="button" variant="outline" onClick={copy} disabled={!url} className="gap-2 text-sm">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? t("settings.calendarFeed.copied") : t("settings.calendarFeed.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={replace}
          disabled={replacing || !url}
          className="gap-2 text-sm"
        >
          <RefreshCw className="size-4" aria-hidden />
          {t("settings.calendarFeed.replace")}
        </Button>
      </div>

      <p className="flex max-w-2xl items-start gap-2 text-sm leading-snug text-ink">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("settings.calendarFeed.warning")}
      </p>
    </div>
  )
}
