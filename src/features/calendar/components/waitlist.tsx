"use client"

import Link from "next/link"
import { GripVertical } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { localizeWaitlistEntry } from "@/lib/i18n/localized-seed"
import { waitlistEntries } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/**
 * Waitlist sidebar.
 *
 * The seeded rows are invented people, and beside a real diary they read as
 * patients genuinely waiting for a slot — each one linking to a record that
 * does not exist. So they go the moment the clinic has patients of its own.
 *
 * Nothing replaces them yet: there is no waitlist table, and an empty list is
 * the truth until there is one. Adding people to it is the feature this is
 * waiting for, and inventing the data in the meantime is what caused the
 * problem.
 */
export function Waitlist() {
  const { locale, t } = useLocale()
  const [clinicIsReal, setClinicIsReal] = useState(false)

  useEffect(() => {
    let cancelled = false
    void clinicHasPatients().then((has) => {
      if (!cancelled) setClinicIsReal(has)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(
    () => (clinicIsReal ? [] : waitlistEntries.map((e) => localizeWaitlistEntry(e, locale))),
    [locale, clinicIsReal],
  )

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
