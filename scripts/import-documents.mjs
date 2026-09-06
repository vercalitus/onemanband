/**
 * Bring the clinic's treatment files into private storage.
 *
 *   node scripts/import-documents.mjs            # dry run, downloads nothing
 *   node scripts/import-documents.mjs --write    # fetch and store
 *
 * These are medical records. They go into the private `patient-media` bucket
 * under `<clinic_id>/<patient_id>/<file>`, which is where the storage policy
 * already expects them: row-level security keyed on the first path segment,
 * reachable only through a signed URL that expires in a minute. Nothing here
 * is ever made public, and no file is attached to a patient on a guess.
 *
 * Which file belongs to whom was decided during the patient import and written
 * onto each patient's `import_source.driveFiles`. This script does not re-run
 * that matching — one decision, recorded once, is the point of having stored
 * it.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const WRITE = process.argv.includes("--write")

const DRIVE_FOLDER_ID =
  process.env.DRIVE_FOLDER_ID ?? "177WIHqc0DHPTQvqRIxdj4V3GcRflupSH"
const BUCKET = "patient-media"
/** How many files to measure for the size estimate in a dry run. */
const SIZE_SAMPLE = 80

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)
const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const REST = { apikey: KEY, Authorization: `Bearer ${KEY}` }

/* ---------------------------------------------------------------- drive --- */

/**
 * The embedded folder view returns the whole listing as plain HTML, with each
 * row's file id in its `entry-` element id. The real Drive page virtualises
 * and only ever holds a screenful.
 */
async function loadDrive() {
  const html = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#list`,
  ).then((r) => r.text())

  const entries = [
    ...html.matchAll(
      /id="entry-([^"]+)"[\s\S]*?class="flip-entry-title">([^<]+)</g,
    ),
  ].map(([, id, title]) => ({
    id,
    file: title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
  }))

  return entries.filter((e) => /\.pdf$/i.test(e.file))
}

const downloadUrl = (id) => `https://drive.google.com/uc?export=download&id=${id}`

/* ------------------------------------------------------------- patients --- */

async function loadPatients() {
  const all = []
  for (let from = 0; ; from += 1000) {
    const page = await fetch(
      `${SUPABASE}/rest/v1/patients?select=id,full_name,import_source&order=id&offset=${from}&limit=1000`,
      { headers: REST },
    ).then((r) => r.json())
    all.push(...page)
    if (page.length < 1000) break
  }
  return all
}

const drive = await loadDrive()
const patients = await loadPatients()

/** file name -> patient, from the decision the import already made. */
const owner = new Map()
for (const p of patients) {
  for (const f of p.import_source?.driveFiles ?? []) owner.set(f, p)
}

const planned = []
const unowned = []
for (const entry of drive) {
  const patient = owner.get(entry.file)
  if (patient) planned.push({ ...entry, patientId: patient.id })
  else unowned.push(entry)
}

console.log(`drive pdfs        : ${drive.length}`)
console.log(`patients in db    : ${patients.length}`)
console.log(`  files to attach : ${planned.length}`)
console.log(`  files with no patient here: ${unowned.length}`)
console.log(`    (near matches awaiting review, and patients not imported)`)

/* ----------------------------------------------------------------- size --- */

async function measure(entries) {
  let total = 0
  let measured = 0
  for (const e of entries) {
    try {
      const res = await fetch(downloadUrl(e.id), { method: "HEAD", redirect: "follow" })
      const len = Number(res.headers.get("content-length"))
      if (Number.isFinite(len) && len > 0) {
        total += len
        measured++
      }
    } catch {
      /* one unreadable header does not change an estimate */
    }
  }
  return { total, measured }
}

// Spread across the folder rather than the first N: the listing is
// alphabetical, and the first eighty files gave an average a quarter too high.
const step = Math.max(1, Math.floor(planned.length / SIZE_SAMPLE))
const sample = planned.filter((_, i) => i % step === 0).slice(0, SIZE_SAMPLE)
const { total, measured } = await measure(sample)
if (measured) {
  const avg = total / measured
  console.log(
    `\nsize: ${(avg / 1024).toFixed(0)} KB average over ${measured} sampled files`,
  )
  console.log(
    `  estimated for ${planned.length} files: ${((avg * planned.length) / 1024 / 1024).toFixed(0)} MB`,
  )
  console.log(
    `  estimated for all ${drive.length}:     ${((avg * drive.length) / 1024 / 1024).toFixed(0)} MB`,
  )
} else {
  console.log("\nsize: could not measure — Drive did not return content lengths")
}

const listPath = resolve(ROOT, "..", "onemanband-documents-plan.json")
writeFileSync(
  listPath,
  JSON.stringify({ planned: planned.length, unowned: unowned.map((u) => u.file) }, null, 1),
  "utf8",
)
console.log(`\nunattached files listed in ${listPath} (outside the repo — it names patients)`)

if (!WRITE) {
  console.log("\nDry run. Nothing was downloaded or stored. Re-run with --write.")
  process.exit(0)
}

/* ---------------------------------------------------------------- write --- */

const clinicId = (
  await fetch(`${SUPABASE}/rest/v1/clinics?select=id&limit=1`, { headers: REST }).then((r) =>
    r.json(),
  )
)[0]?.id
if (!clinicId) throw new Error("no clinic row")

let stored = 0
let failed = 0
for (const item of planned) {
  // Path shape is the storage policy's business: the first segment is the
  // clinic, and that is what row-level security checks.
  const path = `${clinicId}/${item.patientId}/${item.file}`

  const file = await fetch(downloadUrl(item.id), { redirect: "follow" })
  if (!file.ok) {
    failed++
    continue
  }
  const body = Buffer.from(await file.arrayBuffer())

  const up = await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: "POST",
    headers: { ...REST, "Content-Type": "application/pdf", "x-upsert": "true" },
    body,
  })
  if (!up.ok) {
    console.error(`upload failed for one file: HTTP ${up.status}`)
    failed++
    continue
  }

  const row = await fetch(`${SUPABASE}/rest/v1/documents`, {
    method: "POST",
    headers: { ...REST, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      clinic_id: clinicId,
      patient_id: item.patientId,
      bucket: BUCKET,
      storage_path: path,
      file_name: item.file,
      mime_type: "application/pdf",
      file_size_bytes: body.length,
      document_type: "other",
      source_label: "drive-import",
    }),
  })
  if (!row.ok) {
    console.error(`document row failed: HTTP ${row.status} ${await row.text()}`)
    failed++
    continue
  }

  stored++
  if (stored % 50 === 0) console.log(`stored ${stored}/${planned.length}`)
}

console.log(`stored ${stored}/${planned.length}, failed ${failed}`)
