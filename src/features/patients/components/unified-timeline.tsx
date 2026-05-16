"use client"

import { FileText, Receipt } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DocumentRecord, FinanceRecord, TreatmentRecord } from "@/types/domain"
import type { CompletedSession } from "../lib/use-patient-cockpit"

/** Attach documents and finances to the nearest treatment by date. */
function attachRelated(
  treatments: TreatmentEntry[],
  documentRecords: DocumentRecord[],
  financeRecords: FinanceRecord[],
) {
  if (treatments.length === 0) return

  const sortedByDate = [...treatments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const findNearest = (targetDate: string): TreatmentEntry => {
    const t = new Date(targetDate).getTime()
    let best = sortedByDate[0]
    let bestDiff = Math.abs(new Date(best.date).getTime() - t)
    for (const e of sortedByDate) {
      const diff = Math.abs(new Date(e.date).getTime() - t)
      if (diff < bestDiff) {
        bestDiff = diff
        best = e
      }
    }
    return best
  }

  for (const doc of documentRecords) {
    const entry = findNearest(doc.uploadedAt)
    entry.relatedDocs.push(doc)
  }

  for (const fin of financeRecords) {
    const entry = findNearest(fin.issuedAt)
    entry.relatedFinances.push(fin)
  }
}

interface TreatmentEntry {
  id: string
  kind: "treatment" | "completed-session"
  date: string
  title: string
  note: string
  relatedDocs: DocumentRecord[]
  relatedFinances: FinanceRecord[]
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  paid: "text-slate-500",
  issued: "text-slate-600",
  overdue: "text-rose-600",
  draft: "text-slate-400",
  void: "text-slate-400",
}

function formatDate(raw: string) {
  try {
    return new Date(raw).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return raw
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  xray: "X-Ray",
  mri: "MRI",
  insurance: "Insurance",
  lab: "Lab",
  consent: "Consent",
  other: "Document",
}

interface Props {
  treatmentRecords: TreatmentRecord[]
  documentRecords: DocumentRecord[]
  financeRecords: FinanceRecord[]
  completedSessions: CompletedSession[]
}

export function UnifiedTimeline({
  treatmentRecords,
  documentRecords,
  financeRecords,
  completedSessions,
}: Props) {
  // Build combined session list
  const entries: TreatmentEntry[] = [
    ...treatmentRecords.map((t) => ({
      id: t.id,
      kind: "treatment" as const,
      date: t.recordedAt,
      title: t.title,
      note: t.note,
      relatedDocs: [] as DocumentRecord[],
      relatedFinances: [] as FinanceRecord[],
    })),
    ...completedSessions.map((cs) => ({
      id: cs.id,
      kind: "completed-session" as const,
      date: cs.completedAt,
      title: "Session completed",
      note: cs.sessionNotes || "",
      relatedDocs: [] as DocumentRecord[],
      relatedFinances: [] as FinanceRecord[],
    })),
  ]

  // Attach docs and finances to the nearest session
  attachRelated(entries, documentRecords, financeRecords)

  // Sort newest first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-14">
        <div className="text-center">
          <FileText className="mx-auto mb-3 size-7 text-slate-300" aria-hidden />
          <p className="text-sm font-semibold text-slate-500">No sessions yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Complete a session to start the timeline.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-0" aria-label="Patient timeline">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1
        const isCompleted = entry.kind === "completed-session"

        return (
          <li key={entry.id} className="relative flex gap-4 pb-6">
            {/* Thin blue connector line */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[15px] top-9 h-full w-px bg-sky-100"
              />
            )}

            {/* Dot indicator — unified style */}
            <div
              aria-hidden
              className={cn(
                "relative z-10 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border",
                isCompleted
                  ? "border-slate-200 bg-white"
                  : "border-sky-200 bg-sky-50",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  isCompleted ? "bg-slate-400" : "bg-sky-500",
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Date */}
              <p className="mb-1 font-mono text-[11px] tabular-nums text-slate-400">
                {formatDate(entry.date)}
              </p>

              {/* Card */}
              <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{entry.title}</p>

                {entry.note && (
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    {entry.note.slice(0, 220)}
                    {entry.note.length > 220 && "…"}
                  </p>
                )}

                {/* Related docs + invoices as small chips */}
                {(entry.relatedDocs.length > 0 || entry.relatedFinances.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-50 pt-2.5">
                    {entry.relatedDocs.map((doc) => (
                      <span
                        key={doc.id}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                      >
                        <FileText className="size-3 text-slate-400" aria-hidden />
                        {DOC_TYPE_LABELS[doc.type] ?? "Document"} — {doc.name}
                      </span>
                    ))}
                    {entry.relatedFinances.map((fin) => (
                      <span
                        key={fin.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium",
                          INVOICE_STATUS_COLORS[fin.invoiceStatus] ?? "text-slate-500",
                        )}
                      >
                        <Receipt className="size-3 text-slate-400" aria-hidden />
                        {fin.amount} · {fin.invoiceStatus}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
