"use client"

import { useState } from "react"
import { FileImage, FileScan, FileText, FolderOpen, Trash2 } from "lucide-react"

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

const DOC_LABELS: Record<string, string> = {
  xray: "X-Ray",
  mri: "MRI",
  insurance: "Insurance",
  lab: "Lab Results",
  consent: "Consent",
  other: "Document",
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

interface Props {
  documentRecords: DocumentRecord[]
  onDeleteDocument: (id: string) => void
}

/**
 * Compact sidebar card showing all patient documents.
 * One click → document preview modal. Trash icon → confirm delete.
 */
export function PatientLibrary({ documentRecords, onDeleteDocument }: Props) {
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    if (confirmId === id) {
      onDeleteDocument(id)
      setConfirmId(null)
    } else {
      setConfirmId(id)
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000)
    }
  }

  if (documentRecords.length === 0) return null

  return (
    <>
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.07)]">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-50 px-4 py-3">
          <FolderOpen className="size-3.5 text-slate-400" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Patient Library
          </p>
          <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-100 px-1.5 font-mono text-[10px] font-semibold tabular-nums text-slate-500">
            {documentRecords.length}
          </span>
        </div>

        {/* Document list */}
        <ul className="divide-y divide-slate-50">
          {documentRecords.map((doc) => {
            const Icon = DOC_ICONS[doc.type] ?? FileImage
            const label = DOC_LABELS[doc.type] ?? "Document"
            return (
              <li key={doc.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(doc)}
                  className="flex flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                    <Icon className="size-3.5 text-slate-400" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-snug text-slate-700">
                      {doc.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] tabular-nums text-slate-400">
                      {label} · {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className={cn(
                    "mr-3 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                    confirmId === doc.id
                      ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                      : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500",
                  )}
                  aria-label={confirmId === doc.id ? "Confirm delete document" : "Delete document"}
                >
                  <Trash2 className="size-3" aria-hidden />
                  {confirmId === doc.id && <span>Remove</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
