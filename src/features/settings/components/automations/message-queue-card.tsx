"use client"

import { useCallback, useEffect, useState } from "react"
import { Mail, MessageCircle, Play, Smartphone, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { StateLegend, StateMark, type MarkState } from "@/components/ui/state-mark"
import {
  AUTOMATION_STORE_EVENT,
  clearStore,
  listOutbox,
} from "@/features/automations/lib/automation-store"
import { runTick } from "@/features/automations/lib/dispatcher"
import { SettingsSection, SettingsSheet } from "@/features/settings/components/settings-ui"
import { cn } from "@/lib/utils"
import type { MessageChannel, OutboxMessage, OutboxStatus } from "@/types/automation"

const CHANNEL_ICON: Record<MessageChannel, typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: Smartphone,
}

/**
 * Outbox states in the one state vocabulary. `simulated` is a real terminal
 * state, not a success, so it is drawn as unconfirmed rather than done; a
 * failure is the one row somebody has to act on.
 */
const STATUS_MARK: Record<OutboxStatus, MarkState> = {
  pending: "plan",
  simulated: "unsure",
  sent: "done",
  failed: "now",
  cancelled: "cancel",
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
    <SettingsSheet>
      <SettingsSection
        title={t("automations.queue.title")}
        description={t("automations.queue.desc")}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={tick} disabled={busy} className="gap-2 text-sm">
              <Play className="size-4" aria-hidden />
              {t("automations.queue.runNow")}
            </Button>
            <Button variant="ghost" onClick={reset} className="gap-2 text-sm text-mute hover:text-ink">
              <Trash2 className="size-4" aria-hidden />
              {t("automations.queue.clear")}
            </Button>
          </div>
        }
      >
        {lastRun ? <p className="mb-3 text-sm font-medium text-ink">{lastRun}</p> : null}

        {ordered.length === 0 ? (
          <p className="text-sm leading-snug text-mute">{t("automations.queue.empty")}</p>
        ) : (
          <>
            <StateLegend
              className="mb-3"
              items={[
                { state: "plan", label: t("automations.queue.status.pending") },
                { state: "done", label: t("automations.queue.status.sent") },
                { state: "unsure", label: t("automations.queue.status.simulated") },
                { state: "now", label: t("automations.queue.status.failed") },
                { state: "cancel", label: t("automations.queue.status.cancelled") },
              ]}
            />
            <ul className="-mx-4 divide-y divide-hair-soft border-y border-hair-soft sm:-mx-6">
              {ordered.map((message) => {
                const Icon = CHANNEL_ICON[message.channel]
                return (
                  <li key={message.id} className="px-4 py-3.5 sm:px-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StateMark state={STATUS_MARK[message.status]} />
                      <span className="text-[17px] font-medium text-ink">
                        {message.patientName || message.to}
                      </span>
                      <span
                        className={cn(
                          "text-sm text-mute",
                          message.status === "cancelled" && "line-through",
                        )}
                      >
                        {t(`automations.queue.status.${message.status}`)}
                      </span>
                      <span className="ms-auto inline-flex items-center gap-2 text-sm tabular-nums text-mute">
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {fmt(message.scheduledFor)}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink">
                      {message.body}
                    </p>
                    {message.error ? (
                      <p className="mt-1.5 text-sm font-medium text-ink">{message.error}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </SettingsSection>
    </SettingsSheet>
  )
}
