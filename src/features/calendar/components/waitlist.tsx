"use client"

import Link from "next/link"
import { GripVertical } from "lucide-react"
import { useMemo } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { localizeWaitlistEntry } from "@/lib/i18n/localized-seed"
import { waitlistEntries } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/** Waitlist sidebar — overlays Hebrew copy on seeded rows when locale is `he`. */
export function Waitlist() {
  const { locale, t } = useLocale()
  const rows = useMemo(() => waitlistEntries.map((e) => localizeWaitlistEntry(e, locale)), [locale])

  return (
    <div className="space-y-1">
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-400">
          {t("calendar.waitlist.empty")}
        </p>
      ) : (
        rows.map((entry, idx) => (
          <div
            key={entry.id}
            className={cn(
              "group flex gap-3 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-sky-100 hover:bg-white",
              idx > 0 ? "border-t border-slate-100" : "",
            )}
          >
            <span title={t("calendar.waitlist.dragHint")}>
              <GripVertical
                className="mt-0.5 shrink-0 cursor-grab text-slate-300 transition-colors group-hover:text-slate-500"
                aria-hidden
              />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/patients/${entry.patientId}`}
                className="block truncate text-sm font-medium text-slate-900 transition-colors hover:text-sky-700"
              >
                {entry.patientName}
              </Link>
              <p className="mt-0.5 truncate text-xs text-slate-500">{entry.reason}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{entry.availability}</p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
