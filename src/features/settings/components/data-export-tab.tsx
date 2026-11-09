"use client"

import { useState } from "react"
import { Braces, Database, Lock, Sheet } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
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
import { SettingsSection, SettingsSheet, hintClass, labelClass } from "@/features/settings/components/settings-ui"
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
    <div>
      <SettingsSheet>
        <SettingsSection title={t("export.tab.title")} description={t("export.tab.desc")}>
          <p className="max-w-2xl text-[17px] leading-relaxed text-ink">{t("export.tab.body")}</p>
          {/* Outline, not the orange primary: a bulk extraction is a deliberate,
              rare act, and the page's one orange button is the save. */}
          <Button variant="outline" onClick={() => setOpen(true)} className="mt-5 gap-2">
            <Database className="size-4" aria-hidden />
            {t("export.tab.open")}
          </Button>
        </SettingsSection>
      </SettingsSheet>

      <ExportDialog
        open={open}
        onOpenChange={setOpen}
        title={t("export.tab.title")}
        subtitle={t("export.tab.dialogSubtitle")}
      >
        {(options) => (
          <div className="space-y-3">
            <div>
              <p className={cn(labelClass, "mb-2")}>
                {t("export.spreadsheets")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["patients", "appointments", "invoices"] as const).map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    onClick={() => void exportDataset(key, options)}
                    className="justify-start gap-2"
                  >
                    <Sheet className="size-4 text-cobalt" aria-hidden />
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
                    className="justify-start gap-2 border-ink"
                  >
                    <Lock className="size-4" aria-hidden />
                    {t("export.dataset.treatments")}
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-hair-soft pt-3">
              <p className={cn(labelClass, "mb-2")}>
                {t("export.backup")}
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  const source = await loadExportSource(formatMoney)
                  downloadJson(buildFullBackup(options, source), datedFilename("clinic-backup", "json"))
                  setOpen(false)
                }}
                className="w-full justify-start gap-2"
              >
                <Braces className="size-4 text-cobalt" aria-hidden />
                {t("export.backupButton")}
              </Button>
              <p className={cn(hintClass, "mt-1.5")}>
                {t("export.backupHint")}
              </p>
            </div>
          </div>
        )}
      </ExportDialog>
    </div>
  )
}
