"use client"

import { useState } from "react"
import { AlertTriangle, FileImage, FileScan, FileText, FolderOpen, Loader2, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import type { DocumentRecord } from "@/types/domain"
import { DocumentPreviewModal } from "./document-preview-modal"

const DOC_ICONS: Record<string, React.ElementType> = {
  xray: FileScan,
  mri: FileScan,
  insurance: FileText,
  lab: FileText,
  consent: FileText,
  other: FileImage,
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

function docTypeLabel(t: (k: string) => string, type: string) {
  const key = `doc.type.${type}`
  const label = t(key)
  return label === key ? t("doc.type.other") : label
}

interface Props {
  documentRecords: DocumentRecord[]
  onDeleteDocument: (id: string) => void | Promise<boolean>
}

/**
 * Compact sidebar card showing all patient documents.
 * One click → document preview modal. Trash icon → confirm, then delete.
 */
export function PatientLibrary({ documentRecords, onDeleteDocument }: Props) {
  const { t, localeTag } = useLocale()
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  /**
   * A dialog rather than the two-tap trash icon this used to be.
   *
   * That was the right weight when "delete" meant hiding a row in one browser.
   * It now removes a scan of a patient's treatment from the clinic's records
   * for good, which is worth naming the file and saying so before it happens —
   * and worth being impossible to do by brushing past a button twice.
   */
  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    await onDeleteDocument(pendingDelete.id)
    setDeleting(false)
    setPendingDelete(null)
  }

  if (documentRecords.length === 0) return null

  return (
    <>
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.07)]">
        <div className="flex items-center gap-2 border-b border-slate-50 px-4 py-3">
          <FolderOpen className="size-3.5 text-slate-400" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("patientChart.library.title")}
          </p>
          <span className="ms-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-100 px-1.5 font-mono text-[10px] font-semibold tabular-nums text-slate-500">
            {documentRecords.length}
          </span>
        </div>

        <ul className="divide-y divide-slate-50">
          {documentRecords.map((doc) => {
            const Icon = DOC_ICONS[doc.type] ?? FileImage
            const label = docTypeLabel(t, doc.type)
            return (
              <li key={doc.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(doc)}
                  className="flex flex-1 items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-slate-50"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                    <Icon className="size-3.5 text-slate-400" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-snug text-slate-700">
                      {doc.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] tabular-nums text-slate-400">
                      {label} · {formatDate(doc.uploadedAt, localeTag)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(doc)}
                  className={cn(
                    "me-3 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                    "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500",
                  )}
                  aria-label={t("patientChart.library.deleteDocAria")}
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("patientChart.library.deleteTitle")}
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !deleting && setPendingDelete(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.30)]">
            <div className="flex items-start gap-3 px-5 py-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                <AlertTriangle className="size-4.5 text-rose-600" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {t("patientChart.library.deleteTitle")}
                </p>
                <p className="mt-1 break-all font-mono text-[12px] text-slate-600">
                  {pendingDelete.name}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  {t("patientChart.library.deleteBody")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("patientChart.library.deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
