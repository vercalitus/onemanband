"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, FileText, Receipt, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { localizeCompletedSessionTitle } from "@/lib/i18n/localized-seed"
import { cn } from "@/lib/utils"
import type { DocumentRecord, FinanceRecord, TreatmentRecord } from "@/types/domain"
import { DocumentPreviewModal } from "./document-preview-modal"
import type { CompletedSession } from "../lib/use-patient-cockpit"

/** Attach documents and finances to the nearest session by date. */
function attachRelated(
  sessions: SessionEntry[],
  documentRecords: DocumentRecord[],
  financeRecords: FinanceRecord[],
) {
  if (sessions.length === 0) return

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const findNearest = (targetDate: string): SessionEntry => {
    const t = new Date(targetDate).getTime()
    let best = sorted[0]
    let bestDiff = Math.abs(new Date(best.date).getTime() - t)
    for (const e of sorted) {
      const diff = Math.abs(new Date(e.date).getTime() - t)
      if (diff < bestDiff) {
        bestDiff = diff
        best = e
      }
    }
    return best
  }

  for (const doc of documentRecords) findNearest(doc.uploadedAt).relatedDocs.push(doc)
  for (const fin of financeRecords) findNearest(fin.issuedAt).relatedFinances.push(fin)
}

interface SessionEntry {
  id: string
  kind: "treatment" | "completed-session"
  date: string
  title: string
  note: string
  canvasDataUrl?: string | null
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

function formatDate(raw: string, localeTag: string) {
  try {
    return new Date(raw).toLocaleDateString(localeTag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return raw
  }
}

function ClinicalNoteLine({ note, expanded }: { note: string; expanded: boolean }) {
  const dotIdx = note.search(/\.\s/)
  const hasTwoParts = dotIdx !== -1 && dotIdx < note.length - 1
  const summary = hasTwoParts ? note.slice(0, dotIdx + 1) : note
  const detail = hasTwoParts ? note.slice(dotIdx + 2).trim() : ""

  return (
    <div className="mt-1 space-y-0.5">
      <p dir="auto" className="text-[13px] font-medium leading-snug text-slate-700">
        {summary}
      </p>
      {expanded && detail && (
        <p dir="auto" className="text-[12px] leading-relaxed text-slate-400">
          {detail}
        </p>
      )}
    </div>
  )
}

interface Props {
  treatmentRecords: TreatmentRecord[]
  documentRecords: DocumentRecord[]
  financeRecords: FinanceRecord[]
  completedSessions: CompletedSession[]
  planTarget: number
  onDeleteTreatment: (id: string) => void
  onDeleteCompletedSession: (id: string) => void
}

export function UnifiedTimeline({
  treatmentRecords,
  documentRecords,
  financeRecords,
  completedSessions,
  planTarget,
  onDeleteTreatment,
  onDeleteCompletedSession,
}: Props) {
  const { t, localeTag, locale } = useLocale()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  // Build session list
  const entries: SessionEntry[] = [
    ...treatmentRecords.map((t) => ({
      id: t.id,
      kind: "treatment" as const,
      date: t.recordedAt,
      title: t.title,
      note: t.note,
      canvasDataUrl: null,
      relatedDocs: [] as DocumentRecord[],
      relatedFinances: [] as FinanceRecord[],
    })),
    ...completedSessions.map((cs) => ({
      id: cs.id,
      kind: "completed-session" as const,
      date: cs.completedAt,
      title: cs.title,
      note: cs.sessionNotes || "",
      canvasDataUrl: cs.canvasDataUrl,
      relatedDocs: [] as DocumentRecord[],
      relatedFinances: [] as FinanceRecord[],
    })),
  ]

  attachRelated(entries, documentRecords, financeRecords)

  // Assign session numbers (chronological ascending order)
  const chronological = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  const sessionNumberMap = new Map(chronological.map((e, i) => [e.id, i + 1]))

  // Display newest first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-14">
        <div className="text-center">
          <FileText className="mx-auto mb-3 size-7 text-slate-300" aria-hidden />
          <p className="text-sm font-semibold text-slate-500">{t("patientChart.timeline.emptyTitle")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("patientChart.timeline.emptyHint")}</p>
        </div>
      </div>
    )
  }

  const handleDelete = (entry: SessionEntry) => {
    if (confirmDeleteId === entry.id) {
      if (entry.kind === "treatment") {
        onDeleteTreatment(entry.id)
      } else {
        onDeleteCompletedSession(entry.id)
      }
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(entry.id)
      // Auto-cancel confirm after 3 s
      setTimeout(() => setConfirmDeleteId((curr) => (curr === entry.id ? null : curr)), 3000)
    }
  }

  return (
    <>
      <ol className="flex flex-col gap-0" aria-label={t("patientChart.timeline.aria")}>
        {entries.map((entry, idx) => {
          const isLast = idx === entries.length - 1
          const isCompleted = entry.kind === "completed-session"
          const expanded = expandedIds.has(entry.id)
          const sessionNumber = sessionNumberMap.get(entry.id) ?? 0
          const titleShown =
            isCompleted
              ? localizeCompletedSessionTitle(entry.title, locale, t)
              : entry.title
          const hasMore =
            entry.note.search(/\.\s/) !== -1 ||
            entry.relatedDocs.length > 0 ||
            entry.relatedFinances.length > 0 ||
            !!entry.canvasDataUrl
          const confirming = confirmDeleteId === entry.id

          return (
            <li key={entry.id} className="group relative flex gap-4 pb-5">
              {/* Thin connector line */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute start-[15px] top-9 h-full w-px bg-sky-100"
                />
              )}

              {/* Dot */}
              <div
                aria-hidden
                className={cn(
                  "relative z-10 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border",
                  isCompleted ? "border-slate-200 bg-white" : "border-sky-200 bg-sky-50",
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
                {/* Date + session badge + delete (top row, well-separated) */}
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-mono text-[11px] tabular-nums text-slate-400">
                    {formatDate(entry.date, localeTag)}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-slate-400 ring-1 ring-slate-100">
                    {t("patientChart.timeline.sessionOf", { n: sessionNumber, total: planTarget })}
                  </span>

                  {/* Delete — pushed to the far right, separated from the expand chevron */}
                  <button
                    type="button"
                    onClick={() => handleDelete(entry)}
                    className={cn(
                      "ms-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors",
                      confirming
                        ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                        : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500",
                    )}
                    aria-label={confirming ? t("patientChart.timeline.confirmDeleteAria") : t("patientChart.timeline.deleteAria")}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {confirming && <span>{t("patientChart.timeline.confirm")}</span>}
                  </button>
                </div>

                {/* Expandable card */}
                <div
                  className={cn(
                    "rounded-xl border bg-white transition-[border-color,box-shadow]",
                    hasMore
                      ? "cursor-pointer border-slate-100 hover:border-sky-100 hover:shadow-[0_2px_12px_-4px_rgba(14,165,233,0.10)]"
                      : "cursor-default border-slate-100",
                  )}
                >
                  {/* Card header row — clickable */}
                  <button
                    type="button"
                    onClick={() => hasMore && toggle(entry.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-start"
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{titleShown}</p>
                      {entry.note && (
                        <ClinicalNoteLine note={entry.note} expanded={expanded} />
                      )}
                    </div>

                    {/* Prominent expand chevron — clearly separated, larger hit area */}
                    {hasMore && (
                      <span
                        className={cn(
                          "ms-2 flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                          expanded
                            ? "border-sky-200 bg-sky-50 text-sky-600"
                            : "border-slate-200 bg-white text-slate-500 group-hover:border-sky-200 group-hover:bg-sky-50 group-hover:text-sky-600",
                        )}
                        aria-hidden
                      >
                        {expanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </span>
                    )}
                  </button>

                  {/* Expanded area */}
                  {expanded && (
                    <div
                      className="border-t border-slate-50 px-4 pb-3 pt-3 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Canvas snapshot */}
                      {entry.canvasDataUrl && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {t("patientChart.timeline.snapshot")}
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entry.canvasDataUrl}
                            alt={t("patientChart.timeline.snapshotAlt")}
                            className="w-full rounded-lg border border-slate-100 object-contain"
                          />
                        </div>
                      )}

                      {/* Related docs + invoices */}
                      {(entry.relatedDocs.length > 0 || entry.relatedFinances.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.relatedDocs.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                            >
                              <FileText className="size-3 text-slate-400" aria-hidden />
                              {(() => {
                                const key = `doc.type.${doc.type}` as const
                                const label = t(key)
                                const display = label === key ? t("doc.type.other") : label
                                return `${display} — ${doc.name}`
                              })()}
                            </button>
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
                              {(() => {
                                const st = fin.invoiceStatus
                                const sk = `invoice.status.${st}`
                                const label = t(sk)
                                const display = label === sk ? st : label
                                return `${fin.amount} · ${display}`
                              })()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
