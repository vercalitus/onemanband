"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, FileText, Mic, Pencil, Receipt, Trash2 } from "lucide-react"

import { spineLabel } from "@/features/body-map/lib/regions"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { StateMark } from "@/components/ui/state-mark"
import { localizeCompletedSessionTitle } from "@/lib/i18n/localized-seed"
import { signAttachment } from "@/features/patients/lib/treatment-repository"
import { getAudio } from "@/lib/audio-store"
import { cn } from "@/lib/utils"
import type { DocumentRecord, FinanceRecord, TreatmentRecord } from "@/types/domain"
import { DocumentPreviewModal } from "./document-preview-modal"
import type { CompletedSession } from "../lib/use-patient-cockpit"

/** Collapsed-by-default toggle that reveals the handwriting snapshot on demand,
 *  keeping the timeline light instead of rendering a full-width PNG per session. */
function PenNoteCollapsible({ src, path }: { src?: string | null; path?: string }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [signed, setSigned] = useState<string | null>(null)

  // Signed only when the snapshot is actually asked for. A chart with twenty
  // sessions would otherwise mint twenty links into a patient's record to
  // render nothing.
  useEffect(() => {
    if (!open || !path || signed) return
    let cancelled = false
    void signAttachment(path).then((url) => {
      if (!cancelled) setSigned(url)
    })
    return () => {
      cancelled = true
    }
  }, [open, path, signed])

  const imageSrc = src ?? signed
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-start text-sm font-medium transition-colors",
          open ? "border-cobalt bg-cobalt-tint text-ink" : "border-hair bg-paper text-ink hover:bg-ground",
        )}
        aria-expanded={open}
      >
        <Pencil className="size-4 text-mute" aria-hidden />
        {t("patientChart.timeline.penNote")}
        <span className="flex items-center gap-1 font-normal text-mute">
          · {open ? t("patientChart.timeline.penNoteClose") : t("patientChart.timeline.penNoteOpen")}
          {open ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </span>
      </button>
      {open && imageSrc && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageSrc}
          alt={t("patientChart.timeline.snapshotAlt")}
          className="w-full rounded-md border border-hair bg-paper object-contain"
        />
      )}
    </div>
  )
}

/**
 * A session's voice memo.
 *
 * Two places it can be. A saved session keeps it in the patient's private
 * folder and this signs a short-lived link for it; a session recorded before
 * this page reached the database is still in IndexedDB on that machine, and is
 * played from there so nothing that was recorded stops being audible.
 */
function TimelineAudio({ audioKey, audioPath }: { audioKey?: string | null; audioPath?: string }) {
  const { t } = useLocale()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    if (audioPath) {
      void signAttachment(audioPath).then((signed) => {
        if (!cancelled) setUrl(signed)
      })
    } else if (audioKey) {
      void getAudio(audioKey).then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
    }

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [audioKey, audioPath])

  if (!url) return null
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-mute">
        <Mic className="size-4" aria-hidden />
        {t("patientChart.timeline.voiceMemo")}
      </p>
      <audio controls src={url} className="h-9 w-full" aria-label={t("patientChart.audio.playbackAria")} />
    </div>
  )
}

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
  audioKey?: string | null
  /** Private-bucket paths, for a session that was saved to the database. */
  canvasPath?: string
  audioPath?: string
  /** Where on the spine the work was done, in the model's own names. */
  spineLevels?: string[]
  /** Marked as saved in error: kept, struck through, counted for nothing. */
  voidedAt?: string
  voidReason?: string
  relatedDocs: DocumentRecord[]
  relatedFinances: FinanceRecord[]
}

/** A charge still owed: not settled, not refunded, not voided. */
const isUnpaid = (fin: FinanceRecord) =>
  fin.invoiceStatus !== "void" &&
  (fin.paymentStatus === "pending" ||
    fin.paymentStatus === "partially_paid" ||
    fin.paymentStatus === "failed")

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
    <div className="mt-0.5 space-y-1">
      <p dir="auto" className="text-[17px] leading-snug text-ink">
        {summary}
      </p>
      {expanded && detail && (
        <p dir="auto" className="text-sm leading-relaxed text-mute">
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
  /**
   * True once treatment records come from Postgres, where the schema refuses to
   * change or remove one. The delete control is hidden for them rather than
   * shown and then failing: a treatment record that can be quietly unwritten is
   * not a record, and a correction belongs in a new entry that says so.
   */
  treatmentsAreLive: boolean
  onDeleteTreatment: (id: string) => void
  onDeleteCompletedSession: (id: string) => void
  /**
   * The correction the schema allows for a saved session: mark it as saved
   * in error. The row stays, struck through, and stops counting. Absent on a
   * demo chart, where a row is simply deleted.
   */
  onVoidTreatment?: (id: string, reason: string) => void | Promise<boolean>
}

export function UnifiedTimeline({
  treatmentRecords,
  documentRecords,
  financeRecords,
  completedSessions,
  planTarget,
  treatmentsAreLive,
  onDeleteTreatment,
  onDeleteCompletedSession,
  onVoidTreatment,
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
      audioKey: null,
      canvasPath: t.canvasPath,
      audioPath: t.audioPath,
      spineLevels: t.spineLevels,
      voidedAt: t.voidedAt,
      voidReason: t.voidReason,
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
      audioKey: cs.audioKey ?? null,
      spineLevels: cs.spineLevels,
      relatedDocs: [] as DocumentRecord[],
      relatedFinances: [] as FinanceRecord[],
    })),
  ]

  attachRelated(entries, documentRecords, financeRecords)

  // Assign session numbers (chronological ascending order). A record saved in
  // error is not a session and takes no number.
  const chronological = [...entries]
    .filter((e) => !e.voidedAt)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const sessionNumberMap = new Map(chronological.map((e, i) => [e.id, i + 1]))

  // Display newest first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (entries.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <FileText className="mx-auto mb-3 size-7 text-faint" aria-hidden />
        <p className="text-[17px] font-bold text-ink">{t("patientChart.timeline.emptyTitle")}</p>
        <p className="mt-1 text-sm text-mute">{t("patientChart.timeline.emptyHint")}</p>
      </div>
    )
  }

  const handleDelete = (entry: SessionEntry) => {
    if (confirmDeleteId === entry.id) {
      if (entry.kind === "treatment" && treatmentsAreLive) {
        void onVoidTreatment?.(entry.id, "Marked as saved in error")
      } else if (entry.kind === "treatment") {
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
      <ol className="divide-y divide-hair-soft" aria-label={t("patientChart.timeline.aria")}>
        {entries.map((entry) => {
          const isCompleted = entry.kind === "completed-session"
          const expanded = expandedIds.has(entry.id)
          const sessionNumber = sessionNumberMap.get(entry.id) ?? 0
          const titleShown =
            isCompleted
              ? localizeCompletedSessionTitle(entry.title, locale, t)
              : entry.title
          // The pen note sits at the entry level (one press), so it no longer
          // drives the card expand — that's only for secondary detail.
          const hasMore =
            entry.note.search(/\.\s/) !== -1 ||
            entry.relatedDocs.length > 0 ||
            entry.relatedFinances.length > 0 ||
            !!entry.audioKey ||
            !!entry.audioPath
          const confirming = confirmDeleteId === entry.id
          const voided = !!entry.voidedAt
          // A demo row can be deleted. A saved session cannot — it can be
          // marked as saved in error, once, and only while it is not already.
          const voidable = entry.kind === "treatment" && treatmentsAreLive && !!onVoidTreatment && !voided
          const deletable = !(entry.kind === "treatment" && treatmentsAreLive) || voidable
          // What this visit still owes, read from the charges filed beside it.
          const unpaid = entry.relatedFinances.filter(isUnpaid)

          return (
            <li
              key={entry.id}
              className="group grid grid-cols-[12px_minmax(0,1fr)] gap-x-3 px-5 py-4"
            >
              <StateMark
                state={voided ? "cancel" : "done"}
                className="mt-1.5"
                label={voided ? t("patientChart.timeline.voided") : undefined}
              />

              <div className="min-w-0">
                {/* Date, session and what is owed — then the correction, apart. */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3
                    className={cn(
                      "text-[17px] leading-snug",
                      voided ? "font-medium text-mute line-through decoration-1" : "font-bold text-ink",
                    )}
                  >
                    <span className="tabular-nums">{formatDate(entry.date, localeTag)}</span>
                    {!voided && (
                      <>
                        {" · "}
                        {t("patientChart.timeline.sessionOf", { n: sessionNumber, total: planTarget })}
                      </>
                    )}
                  </h3>
                  {voided && (
                    <span className="text-sm text-mute">{t("patientChart.timeline.voided")}</span>
                  )}
                  {!voided &&
                    unpaid.map((fin) => (
                      <span
                        key={fin.id}
                        className="inline-flex min-h-6 items-center rounded-[4px] border-[1.5px] border-signal px-2 text-sm font-medium whitespace-nowrap tabular-nums text-ink"
                      >
                        {t("patientChart.timeline.unpaid", { amount: fin.amount })}
                      </span>
                    ))}

                  {/* Delete (demo) or mark-as-error (saved) — far end, apart
                      from the expand control. Always visible for a saved
                      session: on a tablet there is no hover to reveal it. */}
                  <Button
                    variant="outline"
                    hidden={!deletable}
                    onClick={() => handleDelete(entry)}
                    className={cn(
                      "ms-auto text-sm text-mute",
                      confirming && "border-2 border-signal text-ink",
                      !confirming &&
                        !voidable &&
                        "border-transparent opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                    aria-label={
                      voidable
                        ? confirming
                          ? t("patientChart.timeline.voidConfirm")
                          : t("patientChart.timeline.voidAria")
                        : confirming
                          ? t("patientChart.timeline.confirmDeleteAria")
                          : t("patientChart.timeline.deleteAria")
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {confirming ? (
                      <span className="whitespace-normal">
                        {voidable ? t("patientChart.timeline.voidConfirm") : t("patientChart.timeline.confirm")}
                      </span>
                    ) : voidable ? (
                      <span>{t("patientChart.timeline.voidAria")}</span>
                    ) : null}
                  </Button>
                </div>

                {/* Title and note — the whole block opens the detail. */}
                <button
                  type="button"
                  onClick={() => hasMore && toggle(entry.id)}
                  className={cn(
                    "-mx-2 mt-0.5 flex w-[calc(100%+1rem)] items-start gap-3 rounded-md px-2 py-1 text-start",
                    hasMore ? "min-h-11 cursor-pointer hover:bg-ground" : "cursor-default",
                    voided && "opacity-60 [&_p]:line-through",
                  )}
                  aria-expanded={hasMore ? expanded : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-mute">{titleShown}</p>
                    {/* What was tapped on the spine, read back as words: the
                        line that used to be written by hand. */}
                    {!!entry.spineLevels?.length && (
                      <p className="mt-0.5 text-[17px] leading-snug text-ink">
                        <span className="text-mute">{t("patientChart.spine.recorded")}: </span>
                        <span dir="ltr" className="font-bold">
                          {entry.spineLevels.map((item) => spineLabel(t, item)).join(" · ")}
                        </span>
                      </p>
                    )}
                    {entry.note && <ClinicalNoteLine note={entry.note} expanded={expanded} />}
                  </div>
                  {hasMore &&
                    (expanded ? (
                      <ChevronUp className="mt-0.5 size-5 shrink-0 text-mute" aria-hidden />
                    ) : (
                      <ChevronDown className="mt-0.5 size-5 shrink-0 text-mute" aria-hidden />
                    ))}
                </button>

                {/* Pen note — always at the entry level, one press to open the
                    drawing (it's the primary artifact from the session). */}
                {(entry.canvasDataUrl || entry.canvasPath) && (
                  <div className="mt-2">
                    <PenNoteCollapsible src={entry.canvasDataUrl} path={entry.canvasPath} />
                  </div>
                )}

                {/* Expanded area — secondary detail only */}
                {expanded && (
                  <div className="mt-3 space-y-3">
                    {/* Voice memo */}
                    {(entry.audioKey || entry.audioPath) && (
                      <TimelineAudio audioKey={entry.audioKey} audioPath={entry.audioPath} />
                    )}

                    {/* Related docs + invoices */}
                    {(entry.relatedDocs.length > 0 || entry.relatedFinances.length > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {entry.relatedDocs.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-hair bg-paper px-3 text-sm font-medium text-ink transition-colors hover:bg-ground"
                          >
                            <FileText className="size-4 text-mute" aria-hidden />
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
                              "inline-flex min-h-8 items-center gap-1.5 rounded-[4px] px-2 text-sm font-medium tabular-nums",
                              fin.paymentStatus === "paid"
                                ? "bg-olive-tint text-olive"
                                : isUnpaid(fin)
                                  ? "border-[1.5px] border-signal text-ink"
                                  : "border border-hair text-mute",
                            )}
                          >
                            <Receipt className="size-4" aria-hidden />
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
            </li>
          )
        })}
      </ol>

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
