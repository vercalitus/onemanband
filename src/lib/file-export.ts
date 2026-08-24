/**
 * Browser file downloads for CSV and JSON exports.
 *
 * One place, because the encoding detail below is easy to get wrong and
 * expensive when you do.
 */

/**
 * UTF-8 byte order mark.
 *
 * Excel does not detect UTF-8 in a .csv on its own — without this it decodes
 * the file in the system codepage and every Hebrew and Arabic name arrives as
 * mojibake ("מאיה" → "×ž××™×”"). One character, and it is the difference
 * between a usable export and a useless one in a trilingual clinic.
 *
 * Written as an escape, never as the literal character: a bare U+FEFF is
 * invisible in an editor and gets silently eaten by formatters and tooling —
 * which is exactly how this shipped broken the first time.
 */
const UTF8_BOM = "\uFEFF"

/** RFC 4180: quote a field containing a comma, quote or newline; double inner quotes. */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface CsvColumn<T> {
  header: string
  value: (row: T) => unknown
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")]
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","))
  }
  // CRLF: what Excel expects, and harmless everywhere else.
  return lines.join("\r\n")
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  a.click()
  // Revoking synchronously can cancel the download in some browsers; give the
  // click a turn of the event loop first.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadCsv<T>(
  columns: CsvColumn<T>[],
  rows: T[],
  filename: string,
): void {
  const blob = new Blob([UTF8_BOM + toCsv(columns, rows)], {
    type: "text/csv;charset=utf-8;",
  })
  triggerDownload(blob, filename)
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  })
  triggerDownload(blob, filename)
}

/** `patients-2026-08-24.csv` — dated so successive exports don't overwrite. */
export function datedFilename(base: string, extension: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return `${base}-${stamp}.${extension}`
}
