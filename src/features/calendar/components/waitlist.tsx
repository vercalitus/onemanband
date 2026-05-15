"use client"

import Link from "next/link"
import { GripVertical } from "lucide-react"

import { waitlistEntries, type WaitlistEntry } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const PRIORITY_TONE: Record<WaitlistEntry["priority"], string> = {
  high: "border-rose-200 bg-rose-50/70",
  medium: "border-amber-200 bg-amber-50/70",
  low: "border-slate-200 bg-slate-50/70",
}

const PRIORITY_LABEL: Record<WaitlistEntry["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

/**
 * Calendar sidebar widget — patients awaiting an opening. The grip handle is
 * decorative for now; future iteration will lift each row onto the grid via
 * drag-and-drop, so the row already carries the data attributes it'll need.
 */
export function Waitlist() {
  return (
    <div className="space-y-2.5">
      {waitlistEntries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-400">
          No patients on the waitlist.
        </p>
      ) : (
        waitlistEntries.map((entry) => (
          <div
            key={entry.id}
            data-waitlist-id={entry.id}
            data-patient-id={entry.patientId}
            className={cn(
              "group flex items-start gap-2 rounded-xl border p-3 transition-colors hover:border-sky-200 hover:bg-sky-50/40",
              PRIORITY_TONE[entry.priority],
            )}
          >
            <span
              className="mt-1 shrink-0 cursor-grab text-slate-300 transition-colors group-hover:text-slate-500"
              aria-hidden
              title="Drag to schedule (coming soon)"
            >
              <GripVertical className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/patients/${entry.patientId}`}
                  className="truncate text-sm font-semibold text-slate-900 transition-colors hover:text-sky-700"
                >
                  {entry.patientName}
                </Link>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {PRIORITY_LABEL[entry.priority]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-600">{entry.reason}</p>
              <p className="mt-1 truncate text-[11px] text-slate-400">{entry.availability}</p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
