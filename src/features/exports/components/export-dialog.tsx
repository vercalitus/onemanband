"use client"

import { useState, type ReactNode } from "react"
import { Braces, Download, ShieldAlert, Sheet } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ExportOptions } from "@/features/exports/lib/build-exports"

/**
 * The one export dialog, used for a single patient and for the whole clinic.
 *
 * Shared deliberately: the decision a person makes here — "am I taking the
 * medical notes with me?" — is identical at both scales, and two dialogs would
 * eventually disagree about how that choice is presented.
 *
 * Clinical content is off by default. A patient list with emails is the common
 * export; medical records are the rare, heavier one, and the default should be
 * whichever is safer to get wrong.
 */
export function ExportDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  onExportCsv,
  onExportJson,
  csvLabel,
  jsonLabel,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  onExportCsv?: (options: ExportOptions) => void
  onExportJson?: (options: ExportOptions) => void
  csvLabel?: string
  jsonLabel?: string
  /** Extra per-dataset controls, rendered above the format buttons. */
  children?: (options: ExportOptions) => ReactNode
}) {
  const { t } = useLocale()
  const [includeClinical, setIncludeClinical] = useState(false)
  const options: ExportOptions = { includeClinical }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,32rem)] overflow-hidden p-0" showCloseButton>
        <DialogTitle className="border-b border-slate-100 px-5 py-4 text-base font-semibold text-slate-900">
          {title}
        </DialogTitle>

        <div className="space-y-4 p-5">
          {subtitle ? <p className="text-sm leading-relaxed text-slate-600">{subtitle}</p> : null}

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
              includeClinical
                ? "border-[rgb(248,228,214)] bg-[rgb(255,247,242)]"
                : "border-slate-200 bg-white hover:border-sky-200",
            )}
          >
            <input
              type="checkbox"
              checked={includeClinical}
              onChange={(e) => setIncludeClinical(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                {t("export.includeClinical")}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                {t("export.includeClinicalHint")}
              </span>
            </span>
          </label>

          {children?.(options)}

          {(onExportCsv || onExportJson) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {onExportCsv && (
                <Button onClick={() => onExportCsv(options)} className="h-11 gap-2">
                  <Sheet className="size-4" aria-hidden />
                  {csvLabel ?? t("export.csv")}
                </Button>
              )}
              {onExportJson && (
                <Button
                  variant="outline"
                  onClick={() => onExportJson(options)}
                  className="h-11 gap-2 border-slate-200"
                >
                  <Braces className="size-4" aria-hidden />
                  {jsonLabel ?? t("export.json")}
                </Button>
              )}
            </div>
          )}

          {/*
            Stated at the point of action, not buried in a policy page. Once the
            file lands in Downloads it is outside every protection this app has.
          */}
          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
            <ShieldAlert className="mt-px size-4 shrink-0 text-slate-400" aria-hidden />
            <span>{t("export.warning")}</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Trigger button, so the three entry points look the same. */
export function ExportButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void
  label?: string
  className?: string
}) {
  const { t } = useLocale()
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn("gap-2 border-slate-200 text-slate-700", className)}
    >
      <Download className="size-4 text-sky-600" aria-hidden />
      {label ?? t("export.button")}
    </Button>
  )
}
