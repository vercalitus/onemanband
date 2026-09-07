"use client"

import { Check, Copy, Link2, RefreshCw } from "lucide-react"
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {t("settings.calendarFeed.title")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("settings.calendarFeed.how")}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              dir="ltr"
              value={url ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-700"
              aria-label={t("settings.calendarFeed.title")}
            />
            <Button
              type="button"
              onClick={copy}
              disabled={!url}
              className="h-9 gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? t("settings.calendarFeed.copied") : t("settings.calendarFeed.copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={replace}
              disabled={replacing || !url}
              className="h-9 gap-1.5 rounded-lg border-slate-200 px-3 text-xs font-semibold text-slate-700"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {t("settings.calendarFeed.replace")}
            </Button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-amber-700">
            {t("settings.calendarFeed.warning")}
          </p>
        </div>
      </div>
    </div>
  )
}
