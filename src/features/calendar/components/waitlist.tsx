"use client"

import Link from "next/link"
import { GripVertical } from "lucide-react"

import { waitlistEntries } from "@/lib/mock-data"

/**
 * Calendar sidebar widget — patients awaiting an opening. The grip handle is
 * decorative for now; future iteration will lift each row onto the grid via
 * drag-and-drop, so the row already carries the data attributes it'll need.
 * Visual language stays intentionally neutral (no priority colors) per design.
 */
export function Waitlist() {
  return (
    <div className="space-y-1">
      {waitlistEntries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-400">
          No patients on the waitlist.
        </p>
      ) : (
        waitlistEntries.map((entry, idx) => (
          <div
            key={entry.id}
            data-waitlist-id={entry.id}
            data-patient-id={entry.patientId}
            className={`group flex items-start gap-2 px-1 py-2.5 transition-colors hover:bg-slate-50 ${
              idx > 0 ? "border-t border-slate-100" : ""
            }`}
          >
            <span
              className="mt-0.5 shrink-0 cursor-grab text-slate-300 transition-colors group-hover:text-slate-500"
              aria-hidden
              title="Drag to schedule (coming soon)"
            >
              <GripVertical className="size-4" />
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
