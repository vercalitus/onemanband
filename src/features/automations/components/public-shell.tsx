"use client"

import type { ReactNode } from "react"
import { Stethoscope } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"

/**
 * Chrome for every patient-facing page.
 *
 * Deliberately unlike the clinic app: no sidebar, no navigation, nothing to
 * click except the task at hand. A patient arriving from a WhatsApp link is on
 * a phone, mid-errand, and should be able to finish in one screen. The locale
 * switcher stays because the reminder may have reached them in a language they
 * do not read.
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
    <div className="min-h-screen bg-slate-50" dir={isRtl ? "rtl" : "ltr"}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-600/10">
              <Stethoscope className="size-5 stroke-[1.6] text-sky-700" aria-hidden />
            </span>
            <p className="truncate font-heading text-sm font-bold tracking-tight text-slate-900">
              {clinicName}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{subtitle}</p>
        ) : null}
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
  const chrome =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(140,92,68)]"
        : "border-slate-200 bg-white text-slate-800"

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${chrome}`} role="status">
      <p className="font-semibold">{title}</p>
      {body ? <p className="mt-1.5 text-sm leading-relaxed opacity-90">{body}</p> : null}
    </div>
  )
}
