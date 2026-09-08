"use client"

import { useState } from "react"
import { Braces, Database, Sheet } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExportDialog } from "@/features/exports/components/export-dialog"
import {
  appointmentColumns,
  buildFullBackup,
  exportDatasets,
  invoiceColumns,
  patientColumns,
  treatmentColumns,
  type ExportOptions,
} from "@/features/exports/lib/build-exports"
import { loadExportSource } from "@/features/exports/lib/export-source"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { datedFilename, downloadCsv, downloadJson } from "@/lib/file-export"
import { cn } from "@/lib/utils"

/**
 * Whole-clinic export.
 *
 * Lives in Settings rather than beside the data because a bulk extraction of
 * medical records is a rare, deliberate act — it should take a decision to
 * reach, not sit one stray click from the patient list.
 */
export function DataExportTab() {
  const { t, formatMoney } = useLocale()
  const [open, setOpen] = useState(false)

  /**
   * The clinic's own data, fetched when the button is pressed rather than held
   * in the page. These files are taken rarely and have to be right at the
   * moment they are taken, not right at the moment the tab was opened.
   */
  const exportDataset = async (key: keyof typeof exportDatasets, options: ExportOptions) => {
    const source = await loadExportSource(formatMoney)
    switch (key) {
      case "patients":
        downloadCsv(
          patientColumns(options, source),
          exportDatasets.patients(source),
          datedFilename("patients", "csv"),
        )
        break
      case "appointments":
        downloadCsv(appointmentColumns, exportDatasets.appointments(source), datedFilename("appointments", "csv"))
        break
      case "invoices":
        downloadCsv(invoiceColumns, exportDatasets.invoices(source), datedFilename("invoices", "csv"))
        break
      case "treatments":
        downloadCsv(treatmentColumns, exportDatasets.treatments(source), datedFilename("treatment-records", "csv"))
        break
    }
  }

  return (
    <div className="space-y-5">
      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Database className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">
                {t("export.tab.title")}
              </CardTitle>
              <CardDescription className="text-sky-100/80">{t("export.tab.desc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "space-y-4")}>
          <p className="text-sm leading-relaxed text-slate-600">{t("export.tab.body")}</p>
          <Button onClick={() => setOpen(true)} className="h-11 gap-2">
            <Database className="size-4" aria-hidden />
            {t("export.tab.open")}
          </Button>
        </CardContent>
      </Card>

      <ExportDialog
        open={open}
        onOpenChange={setOpen}
        title={t("export.tab.title")}
        subtitle={t("export.tab.dialogSubtitle")}
      >
        {(options) => (
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t("export.spreadsheets")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["patients", "appointments", "invoices"] as const).map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    onClick={() => void exportDataset(key, options)}
                    className="h-10 justify-start gap-2 border-slate-200 text-slate-800"
                  >
                    <Sheet className="size-4 text-sky-600" aria-hidden />
                    {t(`export.dataset.${key}`)}
                  </Button>
                ))}
                {/*
                  Treatment records are clinical by definition, so this button
                  only exists once the box above is ticked — offering it greyed
                  out would just be an invitation to wonder what's behind it.
                */}
                {options.includeClinical && (
                  <Button
                    variant="outline"
                    onClick={() => void exportDataset("treatments", options)}
                    className="h-10 justify-start gap-2 border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(140,92,68)]"
                  >
                    <Sheet className="size-4" aria-hidden />
                    {t("export.dataset.treatments")}
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t("export.backup")}
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  const source = await loadExportSource(formatMoney)
                  downloadJson(buildFullBackup(options, source), datedFilename("clinic-backup", "json"))
                  setOpen(false)
                }}
                className="h-10 w-full justify-start gap-2 border-slate-200 text-slate-800"
              >
                <Braces className="size-4 text-sky-600" aria-hidden />
                {t("export.backupButton")}
              </Button>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {t("export.backupHint")}
              </p>
            </div>
          </div>
        )}
      </ExportDialog>
    </div>
  )
}
