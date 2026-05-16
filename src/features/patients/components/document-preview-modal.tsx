"use client"

import { FileImage, FileScan, FileText, X } from "lucide-react"

import type { DocumentRecord } from "@/types/domain"

const DOC_ICONS: Record<string, React.ElementType> = {
  xray: FileScan,
  mri: FileScan,
  insurance: FileText,
  lab: FileText,
  consent: FileText,
  other: FileImage,
}

const DOC_LABELS: Record<string, string> = {
  xray: "X-Ray",
  mri: "MRI",
  insurance: "Insurance",
  lab: "Lab Results",
  consent: "Consent Form",
  other: "Document",
}

function formatDate(raw: string) {
  try {
    return new Date(raw).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  } catch {
    return raw
  }
}

interface Props {
  doc: DocumentRecord | null
  onClose: () => void
}

export function DocumentPreviewModal({ doc, onClose }: Props) {
  if (!doc) return null

  const Icon = DOC_ICONS[doc.type] ?? FileImage
  const label = DOC_LABELS[doc.type] ?? "Document"

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${doc.name}`}
    >
      {/* Click outside to close */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.30)]">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
            <Icon className="size-4.5 text-slate-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{doc.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {label} · {formatDate(doc.uploadedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close preview"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
            <Icon className="size-8 text-slate-300" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-500">
            Document preview
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-400">
            Connect cloud storage (Supabase Storage) to enable inline file previews. The document is
            stored at: <span className="font-mono text-slate-500">{doc.source}</span>
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )
}
