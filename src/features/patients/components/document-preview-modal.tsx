"use client"

import { FileImage, FileScan, FileText, X, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { openDocument } from "@/features/patients/lib/document-repository"
import { cn } from "@/lib/utils"
import type { DocumentRecord } from "@/types/domain"

// `LucideIcon`, not `React.ElementType`: react-three-fiber augments the JSX
// namespace, and under that augmentation an ElementType's props resolve to
// `never` — so `className` on one of these stops type-checking.
const DOC_ICONS: Record<string, LucideIcon> = {
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
        className="absolute inset-0 bg-[rgb(14_22_42/0.52)]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-md bg-paper shadow-[0_24px_56px_-16px_rgba(14,22,42,0.45)]",
          // A real document needs room to be read; the placeholder does not.
          doc.storagePath ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center gap-3 border-b border-hair px-5 py-3">
          <Icon className="size-5 shrink-0 text-mute" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-ink">{doc.name}</p>
            <p className="mt-0.5 text-sm text-mute">
              {label} · {formatDate(doc.uploadedAt, localeTag)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ms-auto text-mute"
            aria-label={t("patientChart.docPreview.closeAria")}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </div>

        {doc.storagePath ? (
          /* The file itself. A chart is read, not admired — the preview gets
             the height, and the chrome around it stays out of the way. */
          <div className="h-[70vh] bg-sunk">
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
                <Icon className="size-10 text-faint" aria-hidden />
                <p className="text-[17px] font-medium text-mute">
                  {busy ? t("patientChart.docPreview.opening") : t("patientChart.docPreview.storedTitle")}
                </p>
                {error && <p className="text-sm font-bold text-ink">{error}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <Icon className="size-10 text-faint" aria-hidden />
            <p className="text-[17px] font-medium text-ink">
              {t("patientChart.docPreview.title")}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-mute">
              {t("patientChart.docPreview.body")}{" "}
              <span className="font-mono text-ink">
                {t("patientChart.docPreview.storedAt")} {doc.source}
              </span>
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-hair bg-ground px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button disabled={!url} onClick={openInTab}>
            {t("patientChart.docPreview.openTab")}
          </Button>
        </div>
      </div>
    </div>
  )
}
