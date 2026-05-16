"use client"

import type { BillingInvoice } from "@/types/domain"

const TREATMENT_LABEL: Record<string, string> = {
  first: "First Visit",
  adjustments: "Adjustments",
  kupa: "Kupa",
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Accountant-friendly CSV of the current History list (filtered view).
 */
export function downloadHistoryCsv(invoices: BillingInvoice[], filename = "invoice-history.csv"): void {
  const headers = [
    "Invoice ID",
    "Patient",
    "Amount",
    "Status",
    "Treatment",
    "Issued",
    "Paid",
  ]
  const lines = [headers.join(",")]
  for (const inv of invoices) {
    const row = [
      inv.id,
      inv.patientName,
      String(inv.amount),
      inv.status,
      TREATMENT_LABEL[inv.treatmentType] ?? inv.treatmentType,
      inv.issuedAt ?? "",
      inv.paidAt ?? "",
    ].map((c) => escapeCsvCell(String(c)))
    lines.push(row.join(","))
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Opens a print dialog so the user can save as PDF — avoids a heavy PDF dependency.
 */
export function printHistoryForPdf(invoices: BillingInvoice[], title = "Invoice history"): void {
  const w = window.open("", "_blank", "noopener,noreferrer")
  if (!w) return

  const rows = invoices
    .map(
      (inv) => `
    <tr>
      <td>${escapeHtml(inv.id)}</td>
      <td>${escapeHtml(inv.patientName)}</td>
      <td class="num">${escapeHtml(inv.displayAmount)}</td>
      <td>${escapeHtml(inv.status)}</td>
      <td>${escapeHtml(TREATMENT_LABEL[inv.treatmentType] ?? inv.treatmentType)}</td>
      <td>${escapeHtml(inv.issuedAt ?? "—")}</td>
      <td>${escapeHtml(inv.paidAt ?? "—")}</td>
    </tr>`,
    )
    .join("")

  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    .num { font-variant-numeric: tabular-nums; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <thead>
      <tr>
        <th>Invoice ID</th>
        <th>Patient</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Treatment</th>
        <th>Issued</th>
        <th>Paid</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`)
  w.document.close()
  const printNow = () => {
    try {
      w.focus()
      w.print()
    } catch {
      /* window may block focus from automated contexts */
    }
  }
  if (w.document.readyState === "complete") {
    printNow()
  } else {
    w.onload = printNow
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
