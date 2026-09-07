"use client"

import { FileImage, FileScan, FileText, X } from "lucide-react"
import { useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { openDocument } from "@/features/patients/lib/document-repository"
import { cn } from "@/lib/utils"
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
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch a link as soon as the document is opened, and show the file itself.
   *
   * The link is minted per open and expires in minutes, so it is held only for
   * as long as this dialog is on screen and dropped when it closes — a link
   * into a patient's record should not outlive the moment someone asked to see
   * it. Nothing is cached, and reopening asks again.
   */
  useEffect(() => {
    setUrl(null)
    setError(null)
    if (!doc?.storagePath) return

    let cancelled = false
    setBusy(true)
    void openDocument(doc.id).then((signed) => {
      if (cancelled) return
      setBusy(false)
      if (signed) setUrl(signed)
      else setError(t("patientChart.docPreview.failed"))
    })
    return () => {
      cancelled = true
    }
  }, [doc?.id, doc?.storagePath, t])

  if (!doc) return null

  const openInTab = () => {
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

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

      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.30)]",
          // A real document needs room to be read; the placeholder does not.
          doc.storagePath ? "max-w-4xl" : "max-w-lg",
        )}
      >
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

        {doc.storagePath ? (
          /* The file itself. A chart is read, not admired — the preview gets
             the height, and the chrome around it stays out of the way. */
          <div className="h-[70vh] bg-slate-100">
            {url && (
              <iframe
                src={url}
                title={doc.name}
                className="size-full border-0"
                // The document comes from the storage host, not from us; there
                // is nothing for it to script against here, and sandboxing it
                // outright stops some viewers rendering at all.
                referrerPolicy="no-referrer"
              />
            )}
            {!url && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-100 bg-white">
                  <Icon className="size-8 text-slate-300" aria-hidden />
                </div>
                <p className="text-sm font-medium text-slate-500">
                  {busy ? t("patientChart.docPreview.opening") : t("patientChart.docPreview.storedTitle")}
                </p>
                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
              <Icon className="size-8 text-slate-300" aria-hidden />
            </div>
            <p className="text-sm font-medium text-slate-500">
              {t("patientChart.docPreview.title")}
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-slate-400">
              {t("patientChart.docPreview.body")}{" "}
              <span className="font-mono text-slate-500">
                {t("patientChart.docPreview.storedAt")} {doc.source}
              </span>
            </p>
          </div>
        )}

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
            disabled={!url}
            onClick={openInTab}
            className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("patientChart.docPreview.openTab")}
          </button>
        </div>
      </div>
    </div>
  )
}
