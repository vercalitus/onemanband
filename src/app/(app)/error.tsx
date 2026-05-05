"use client"

import { useEffect } from "react"

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app error]", error)
  }, [error])

  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-600">
        {isDev
          ? error.message || "Unknown error (check the terminal where `next dev` is running)."
          : "Please try again or go back to the dashboard."}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-slate-400">Error ID: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to dashboard
        </a>
      </div>
      {isDev ? (
        <p className="text-xs text-slate-500">
          Tip: the real stack trace appears in the terminal running <code className="rounded bg-slate-100 px-1">next dev</code> or{" "}
          <code className="rounded bg-slate-100 px-1">next start</code>, not only in the browser.
        </p>
      ) : null}
    </div>
  )
}
