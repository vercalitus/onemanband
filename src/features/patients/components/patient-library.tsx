"use client"

import { useRef, useState } from "react"
import {
  AlertTriangle,
  FileImage,
  FileScan,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { MAX_DOCUMENT_BYTES } from "@/features/patients/lib/document-repository"
import { cn } from "@/lib/utils"
import type { DocumentRecord, DocumentType } from "@/types/domain"
import { DocumentPreviewModal } from "./document-preview-modal"

const DOC_ICONS: Record<string, React.ElementType> = {
  xray: FileScan,
  mri: FileScan,
  insurance: FileText,
  lab: FileText,
  consent: FileText,
  other: FileImage,
}

/** The kinds a document can be filed as — the database enum, in display order. */
const DOC_TYPES: DocumentType[] = ["xray", "mri", "lab", "insurance", "consent", "other"]

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
  /**
   * Absent on a chart with no database behind it — the demo has nowhere to put
   * a file, so it does not offer to take one.
   */
  onUploadDocument?: (file: File, type: DocumentType) => Promise<boolean>
}

/**
 * Compact card showing all patient documents.
 * One click → document preview modal. Trash icon → confirm, then delete.
 * The footer takes a new file, when the chart can keep one.
 */
export function PatientLibrary({ documentRecords, onDeleteDocument, onUploadDocument }: Props) {
  const { t, localeTag } = useLocale()
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [uploadType, setUploadType] = useState<DocumentType>("other")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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

  const handleFile = async (file: File | undefined) => {
    if (!file || !onUploadDocument) return
    setUploadError(null)
    // Said here, before the bytes leave the machine, rather than as a storage
    // error afterwards that names nothing the practitioner can act on.
    if (file.size > MAX_DOCUMENT_BYTES) {
      setUploadError(t("patientChart.library.tooLarge"))
      return
    }
    setUploading(true)
    await onUploadDocument(file, uploadType)
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ""
  }

  // Nothing to show and nothing to offer: the demo chart with no documents.
  if (documentRecords.length === 0 && !onUploadDocument) return null

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

        {documentRecords.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-400">{t("patientChart.library.empty")}</p>
        ) : (
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
        )}

        {onUploadDocument && (
          <div className="border-t border-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as DocumentType)}
                disabled={uploading}
                aria-label={t("patientChart.library.add")}
                className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100 disabled:opacity-50"
              >
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {docTypeLabel(t, type)}
                  </option>
                ))}
              </select>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-3.5" aria-hidden />
                )}
                {uploading ? t("patientChart.library.uploading") : t("patientChart.library.add")}
              </button>
            </div>
            {uploadError && (
              <p className="mt-2 text-[11px] font-medium text-rose-600">{uploadError}</p>
            )}
          </div>
        )}
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
