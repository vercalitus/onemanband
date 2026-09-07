"use client"

import { FileImage, FileScan, FileText, X } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { openDocument } from "@/features/patients/lib/document-repository"
import type { DocumentRecord } from "@/types/domain"

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
      month: "long",
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
  doc: DocumentRecord | null
  onClose: () => void
}

export function DocumentPreviewModal({ doc, onClose }: Props) {
  const { t, localeTag } = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Ask the server for a link and follow it.
   *
   * The link is minted per click and expires in about a minute, so it is not
   * kept anywhere — not in state, not in the DOM. A patient record that stayed
   * openable from a stale tab would be a link that outlives the session that
   * earned it.
   */
  const open = async () => {
    if (!doc?.storagePath) return
    setBusy(true)
    setError(null)
    const url = await openDocument(doc.id)
    setBusy(false)
    if (!url) {
      setError(t("patientChart.docPreview.failed"))
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  if (!doc) return null

  const Icon = DOC_ICONS[doc.type] ?? FileImage
  const label = docTypeLabel(t, doc.type)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("patientChart.docPreview.aria", { name: doc.name })}
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.30)]">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
            <Icon className="size-4.5 text-slate-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{doc.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {label} · {formatDate(doc.uploadedAt, localeTag)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-label={t("patientChart.docPreview.closeAria")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
            <Icon className="size-8 text-slate-300" aria-hidden />
          </div>
          {doc.storagePath ? (
            <>
              <p className="text-sm font-medium text-slate-600">
                {t("patientChart.docPreview.storedTitle")}
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-slate-400">
                {t("patientChart.docPreview.storedBody")}
              </p>
              {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-500">
                {t("patientChart.docPreview.title")}
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-slate-400">
                {t("patientChart.docPreview.body")}{" "}
                <span className="font-mono text-slate-500">
                  {t("patientChart.docPreview.storedAt")} {doc.source}
                </span>
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            disabled={!doc.storagePath || busy}
            onClick={open}
            className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t("patientChart.docPreview.opening") : t("patientChart.docPreview.open")}
          </button>
        </div>
      </div>
    </div>
  )
}
