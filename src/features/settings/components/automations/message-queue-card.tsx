"use client"

import { useCallback, useEffect, useState } from "react"
import { Inbox, Mail, MessageCircle, Play, Smartphone, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AUTOMATION_STORE_EVENT,
  clearStore,
  listOutbox,
} from "@/features/automations/lib/automation-store"
import { runTick } from "@/features/automations/lib/dispatcher"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { cn } from "@/lib/utils"
import type { MessageChannel, OutboxMessage, OutboxStatus } from "@/types/automation"

const CHANNEL_ICON: Record<MessageChannel, typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: Smartphone,
}

const STATUS_CHROME: Record<OutboxStatus, string> = {
  pending: "border-sky-200 bg-sky-50 text-sky-700",
  simulated: "border-violet-200 bg-violet-50 text-violet-700",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
}

/**
 * The simulated message queue.
 *
 * This is the honest window into what the automation engine produced: every
 * message that would leave the building, with its exact due time and rendered
 * copy. Until a provider is wired, "Run now" delivers into `simulated` rather
 * than pretending to send — the state on screen is the real state.
 */
export function MessageQueueCard() {
  const { t, localeTag } = useLocale()
  const [messages, setMessages] = useState<OutboxMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [lastRun, setLastRun] = useState<string>("")

  const refresh = useCallback(() => setMessages(listOutbox()), [])

  useEffect(() => {
    refresh()
    window.addEventListener(AUTOMATION_STORE_EVENT, refresh)
    return () => window.removeEventListener(AUTOMATION_STORE_EVENT, refresh)
  }, [refresh])

  const tick = async () => {
    setBusy(true)
    const summary = await runTick()
    setLastRun(
      t("automations.queue.tickResult", {
        processed: summary.processed,
        sent: summary.sent,
        failed: summary.failed,
      }),
    )
    refresh()
    setBusy(false)
  }

  const reset = () => {
    clearStore()
    setLastRun("")
    refresh()
  }

  // Soonest first — the queue is a schedule, so ordering by time is the only
  // ordering that reads correctly.
  const ordered = [...messages].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  )

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    )

  return (
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Inbox className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">
                {t("automations.queue.title")}
              </CardTitle>
              <CardDescription className="text-sky-100/80">
                {t("automations.queue.desc")}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={tick} disabled={busy} className="gap-1.5">
              <Play className="size-3.5" aria-hidden />
              {t("automations.queue.runNow")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={reset}
              className="gap-1.5 text-sky-100 hover:text-white"
            >
              <Trash2 className="size-3.5" aria-hidden />
              {t("automations.queue.clear")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn(elevatedCardBodyClass, "space-y-3")}>
        {lastRun ? <p className="text-sm font-medium text-slate-600">{lastRun}</p> : null}

        {ordered.length === 0 ? (
          <p className="text-sm leading-relaxed text-slate-500">{t("automations.queue.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {ordered.map((message) => {
              const Icon = CHANNEL_ICON[message.channel]
              return (
                <li
                  key={message.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="text-sm font-semibold text-slate-900">
                      {message.patientName || message.to}
                    </span>
                    <Badge variant="outline" className={STATUS_CHROME[message.status]}>
                      {t(`automations.queue.status.${message.status}`)}
                    </Badge>
                    <span className="ms-auto font-mono text-xs tabular-nums text-slate-500">
                      {fmt(message.scheduledFor)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {message.body}
                  </p>
                  {message.error ? (
                    <p className="mt-1.5 text-xs font-medium text-[rgb(171,119,93)]">
                      {message.error}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
