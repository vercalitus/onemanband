"use client"

import Link from "next/link"
import { ArrowLeft, SearchX } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"

/**
 * Where a bad link inside the app lands.
 *
 * Without this file, Next serves its own bare "404 — This page could not be
 * found": no explanation, no navigation, nothing to press. A practitioner
 * followed a link to a patient that was not there and had no way back except
 * retyping the address — which on a tablet, mid-clinic, means the app has
 * simply stopped working as far as he is concerned.
 *
 * It sits inside the `(app)` group so it renders in the shell, with the sidebar
 * and the header still around it. Being lost is not the same as being logged
 * out, and the page should not look like it.
 */
export default function AppNotFound() {
  const { t } = useLocale()

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-slate-100">
        <SearchX className="size-6 text-slate-400" aria-hidden />
      </span>
      <h1 className="font-heading text-lg font-semibold text-slate-900">{t("notFound.title")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{t("notFound.body")}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/patients"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("notFound.toPatients")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {t("notFound.toDashboard")}
        </Link>
      </div>
    </div>
  )
}
