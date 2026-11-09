"use client"

import type { ReactNode } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { StateMark } from "@/components/ui/state-mark"
import { cn } from "@/lib/utils"

/**
 * Chrome for every patient-facing page.
 *
 * Deliberately unlike the clinic app: no sidebar, no navigation, nothing to
 * click except the task at hand. A patient arriving from a WhatsApp link is on
 * a phone, mid-errand, and should be able to finish in one screen. The locale
 * switcher stays because the reminder may have reached them in a language they
 * do not read.
 *
 * The one thing it shares with the app is the cobalt band, so the page reads
 * as the clinic's own: a slim strip carrying the clinic's name, then one calm
 * column on the ground.
 */
export function PublicShell({
  clinicName,
  title,
  subtitle,
  children,
}: {
  clinicName: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const { isRtl } = useLocale()

  return (
    <div className="min-h-screen bg-ground text-ink" dir={isRtl ? "rtl" : "ltr"}>
      <header className="on-cobalt bg-cobalt text-white">
        <div className="mx-auto flex min-h-16 max-w-xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="min-w-0 truncate font-display text-[22px] leading-tight text-white">{clinicName}</p>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-7 pb-12 sm:px-6 sm:pt-10">
        <h1 className="text-[22px] leading-tight font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mt-2 text-[17px] leading-relaxed text-mute">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}

/** Terminal state for a link that cannot be used — expired, spent or unknown. */
export function PublicNotice({
  tone = "info",
  title,
  body,
}: {
  tone?: "info" | "success" | "error"
  title: string
  body?: string
}) {
  return (
    <div className="rounded-md border border-hair bg-paper p-5" role="status">
      <p className="flex items-center gap-3 text-[17px] leading-snug font-bold text-ink">
        {/* Done is filled olive; a link that can no longer be used is struck. */}
        {tone === "success" ? <StateMark state="done" className="size-3.5" /> : null}
        {tone === "error" ? <StateMark state="cancel" className="size-3.5" /> : null}
        {title}
      </p>
      {body ? (
        <p className={cn("mt-2 text-[17px] leading-relaxed text-mute", tone !== "info" && "ps-[26px]")}>{body}</p>
      ) : null}
    </div>
  )
}
