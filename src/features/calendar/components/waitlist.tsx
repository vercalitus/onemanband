"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useScheduleDay } from "@/components/providers/schedule-day-provider"
import { Button } from "@/components/ui/button"
import { clinicHasPatients } from "@/features/patients/lib/patient-repository"
import { localizeWaitlistEntry } from "@/lib/i18n/localized-seed"
import { waitlistEntries } from "@/lib/mock-data"

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
export function Waitlist({ bookDate }: { bookDate?: string }) {
  const { locale, t } = useLocale()
  const { openCreateAppointment } = useScheduleDay()
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
    <section aria-labelledby="waitlist-heading">
      <div className="flex min-h-14 items-center border-b border-hair px-5">
        <h2 id="waitlist-heading" className="flex items-baseline gap-2 text-[17px] font-bold text-ink">
          {t("calendar.page.waitlist")}
          <span className="text-sm font-medium tabular-nums text-mute">{rows.length}</span>
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-mute">{t("calendar.waitlist.empty")}</p>
      ) : (
        rows.map((entry) => (
          <div key={entry.id} className="grid border-b border-hair-soft px-5 pt-1.5 pb-3.5">
            <Link
              href={`/patients/${entry.patientId}`}
              className="inline-flex min-h-11 items-center justify-self-start truncate text-[17px] font-bold text-ink hover:text-cobalt hover:underline"
            >
              {entry.patientName}
            </Link>
            <p className="text-sm text-mute">
              {entry.availability} · {entry.reason}
            </p>
            {/* Opens the ordinary booking dialog for this patient — the same
                path, and the same checks, as any other new visit. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-11 justify-self-start px-4"
              onClick={() => openCreateAppointment(bookDate, { id: entry.patientId, name: entry.patientName })}
            >
              {t("dashboard.day.book")}
            </Button>
          </div>
        ))
      )}
    </section>
  )
}
