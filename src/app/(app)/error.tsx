"use client"

import { useEffect } from "react"

import { useLocale } from "@/components/providers/locale-provider"

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLocale()

  useEffect(() => {
    console.error("[app error]", error)
  }, [error])

  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold text-slate-900">{t("error.title")}</h1>
      <p className="text-sm text-slate-600">
        {isDev
          ? error.message || t("error.devFallback")
          : t("error.prodBody")}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-slate-400">{t("error.digest", { digest: error.digest })}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800"
        >
          {t("error.tryAgain")}
        </button>
        <a
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {t("error.backDashboard")}
        </a>
      </div>
      {isDev ? <p className="text-xs text-slate-500">{t("error.devTip")}</p> : null}
    </div>
  )
}
