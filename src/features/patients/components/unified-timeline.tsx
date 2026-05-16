"use client"

import { FileImage, FileText, Receipt, Stethoscope } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DocumentRecord, FinanceRecord, TreatmentRecord } from "@/types/domain"
import type { CompletedSession } from "../lib/use-patient-cockpit"

type TimelineKind = "treatment" | "completed-session" | "document" | "finance"

interface TimelineEntry {
  id: string
  kind: TimelineKind
  date: string
  label: string
  sub?: string
  badge?: string
  badgeColor?: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  xray: "X-Ray",
  mri: "MRI",
  insurance: "Insurance",
  lab: "Lab",
  consent: "Consent",
  other: "Document",
}

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  issued: "bg-sky-50 text-sky-700 border-sky-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  void: "bg-slate-100 text-slate-400 border-slate-200",
}

const KIND_CONFIG: Record<
  TimelineKind,
  { icon: React.ElementType; ring: string; iconColor: string }
> = {
  treatment: {
    icon: Stethoscope,
    ring: "ring-violet-100 bg-violet-50",
    iconColor: "text-violet-600",
  },
  "completed-session": {
    icon: Stethoscope,
    ring: "ring-emerald-100 bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  document: {
    icon: FileImage,
    ring: "ring-sky-100 bg-sky-50",
    iconColor: "text-sky-600",
  },
  finance: {
    icon: Receipt,
    ring: "ring-amber-100 bg-amber-50",
    iconColor: "text-amber-600",
  },
}

function buildTimeline(
  treatmentRecords: TreatmentRecord[],
  documentRecords: DocumentRecord[],
  financeRecords: FinanceRecord[],
  completedSessions: CompletedSession[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  for (const t of treatmentRecords) {
    entries.push({
      id: t.id,
      kind: "treatment",
      date: t.recordedAt,
      label: t.title,
      sub: t.note,
      badge: "Treatment",
    })
  }

  for (const d of documentRecords) {
    entries.push({
      id: d.id,
      kind: "document",
      date: d.uploadedAt,
      label: d.name,
      sub: d.source,
      badge: DOC_TYPE_LABELS[d.type] ?? "Document",
    })
  }

  for (const f of financeRecords) {
    entries.push({
      id: f.id,
      kind: "finance",
      date: f.issuedAt,
      label: f.description,
      sub: `${f.amount}`,
      badge: f.invoiceStatus.charAt(0).toUpperCase() + f.invoiceStatus.slice(1),
      badgeColor: INVOICE_STATUS_STYLES[f.invoiceStatus],
    })
  }

  for (const cs of completedSessions) {
    entries.push({
      id: cs.id,
      kind: "completed-session",
      date: cs.completedAt,
      label: "Session completed",
      sub: cs.sessionNotes ? cs.sessionNotes.slice(0, 140) : "No notes.",
    })
  }

  // Sort newest first
  entries.sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    return db - da
  })

  return entries
}

function formatDate(raw: string) {
  try {
    const d = new Date(raw)
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return raw
  }
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
  const entries = buildTimeline(treatmentRecords, documentRecords, financeRecords, completedSessions)

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 py-14">
        <div className="text-center">
          <FileText className="mx-auto mb-3 size-8 text-slate-300" aria-hidden />
          <p className="text-sm font-semibold text-slate-500">No records yet</p>
          <p className="mt-1 text-xs text-slate-400">Complete a session to start the timeline.</p>
        </div>
      </div>
    )
  }

  return (
    <ol className="relative flex flex-col gap-0 pl-2" aria-label="Patient timeline">
      {entries.map((entry, idx) => {
        const config = KIND_CONFIG[entry.kind]
        const Icon = config.icon
        const isLast = idx === entries.length - 1

        return (
          <li key={entry.id} className="relative flex gap-4 pb-6">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[17px] top-10 h-full w-[2px] rounded-full bg-slate-100"
              />
            )}

            {/* Icon badge */}
            <div
              className={cn(
                "relative z-10 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ring-4",
                config.ring,
              )}
              aria-hidden
            >
              <Icon className={cn("size-4", config.iconColor)} />
            </div>

            {/* Content card */}
            <div className="flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.07)]">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <p className="flex-1 text-sm font-semibold leading-snug text-slate-800">
                  {entry.label}
                </p>
                {entry.badge && (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      entry.badgeColor ?? "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    {entry.badge}
                  </span>
                )}
              </div>

              {entry.sub && (
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{entry.sub}</p>
              )}

              <p className="mt-2 font-mono text-[11px] tabular-nums text-slate-400">
                {formatDate(entry.date)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
