/**
 * One-off import of the clinic's patient list into Postgres.
 *
 *   node scripts/import-patients.mjs            # dry run, writes nothing
 *   node scripts/import-patients.mjs --write    # actually inserts
 *
 * The clinic's history lives in two places that never knew about each other:
 * a bookkeeping account, which only knows who was invoiced, and a Drive folder
 * of treatment files, which only knows who was treated. Neither holds an id the
 * other would recognise. The only shared field is a person's name — so this
 * joins on names, and treats every join as a claim to be recorded rather than
 * a fact to be trusted.
 *
 * Two rules it does not bend:
 *
 *   - A file is never attached to a patient on a near match. Near matches are
 *     written to a review file for a human. Attaching one person's treatment
 *     notes to another is not a data-quality problem, it is a clinical one.
 *   - Nothing is written to SUMIT. Reads only; the account is the clinic's
 *     live bookkeeping and every write there is approved separately.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const WRITE = process.argv.includes("--write")

/** Patients whose most recent trace is older than this are out of scope. */
const EARLIEST_YEAR = 2023

const SUMIT_CUSTOMERS_CSV =
  process.env.SUMIT_CUSTOMERS_CSV ??
  "C:/Users/verca/Downloads/Table_1726637032_2334244517_202609061931.csv"
const DRIVE_FOLDER_ID =
  process.env.DRIVE_FOLDER_ID ?? "177WIHqc0DHPTQvqRIxdj4V3GcRflupSH"

/* ------------------------------------------------------------------ env --- */

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)

const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const REST = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

/* ------------------------------------------------------------------ csv --- */

/** SUMIT exports Hebrew in the legacy Windows codepage, not UTF-8. */
function loadCsv(path) {
  const text = new TextDecoder("windows-1255").decode(readFileSync(path))
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const split = (line) => {
    const out = []
    let cur = ""
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = !quoted
      } else if (c === "," && !quoted) {
        out.push(cur)
        cur = ""
      } else cur += c
    }
    out.push(cur)
    return out
  }
  const header = split(lines[0])
  return { header, rows: lines.slice(1).map(split) }
}

/* ---------------------------------------------------------------- names --- */

/**
 * Compare names with accents, case, punctuation and word order removed —
 * "Abed zuabi" and "Zuabi, Abed" are one person. Nothing beyond that is
 * inferred here; anything less than identical under this rule goes to review.
 */
const nameKey = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ")

function editDistance(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/* --------------------------------------------------------------- drive ---- */

/**
 * Google's embedded folder view returns the whole listing as plain HTML, which
 * the real Drive page does not — it virtualises and only ever holds a screenful.
 */
async function loadDrive() {
  const html = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#list`,
  ).then((r) => r.text())

  const rows = [
    ...html.matchAll(
      /class="flip-entry-title">([^<]+)<[\s\S]*?class="flip-entry-last-modified"><div>([^<]*)</g,
    ),
  ].map((m) => ({
    file: m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim(),
    modified: m[2].trim(),
  }))

  // Drive prints M/D/YY for older files and "Sep 4" for the current year, so a
  // missing year means this year rather than an unknown one.
  const thisYear = new Date().getFullYear()
  const yearOf = (d) => {
    const four = d.match(/\b(\d{4})\b/)
    if (four) return Number(four[1])
    const two = d.match(/\b\d{1,2}\/\d{1,2}\/(\d{2})\b/)
    if (two) return 2000 + Number(two[1])
    return thisYear
  }

  return rows
    .filter((r) => /\.pdf$/i.test(r.file))
    .map((r) => ({ ...r, year: yearOf(r.modified) }))
}

/* ---------------------------------------------------------------- build --- */

const cust = loadCsv(SUMIT_CUSTOMERS_CSV)
const iName = cust.header.indexOf("שם מלא")
const iEmail = cust.header.indexOf("כתובת מייל")
if (iName < 0) throw new Error("customers export has no 'שם מלא' column")

const drive = await loadDrive()

/** One record per person, however many sources or cards mention them. */
const people = new Map()

const upsert = (key, patch) => {
  const cur = people.get(key) ?? {
    name: null,
    email: null,
    sumitNames: [],
    driveFiles: [],
    latestYear: 0,
    sources: new Set(),
  }
  people.set(key, { ...cur, ...patch(cur) })
}

for (const row of cust.rows) {
  const name = (row[iName] ?? "").trim()
  if (!name) continue
  const email = (row[iEmail] ?? "").trim() || null
  upsert(nameKey(name), (cur) => ({
    name: cur.name ?? name,
    // First non-empty email wins; duplicate cards for one person overwhelmingly
    // carry the same address, and where they differ a human decides.
    email: cur.email ?? email,
    sumitNames: [...new Set([...cur.sumitNames, name])],
    sources: cur.sources.add("sumit"),
  }))
}

const review = []
const driveKeys = [...people.keys()]

for (const entry of drive) {
  const key = nameKey(entry.file)
  if (people.has(key)) {
    upsert(key, (cur) => ({
      driveFiles: [...cur.driveFiles, entry.file],
      latestYear: Math.max(cur.latestYear, entry.year),
      sources: cur.sources.add("drive"),
    }))
    continue
  }

  // Not an exact match. Find the closest known person, but never attach on it.
  let best = { key: null, dist: Infinity }
  for (const k of driveKeys) {
    const d = editDistance(key, k)
    if (d < best.dist) best = { key: k, dist: d }
  }
  const longer = Math.max(key.length, best.key?.length ?? 0)
  if (best.dist <= 2 || (longer && best.dist / longer <= 0.25)) {
    /*
     * Held aside, and this is the whole judgement of the import.
     *
     * A near match must not be attached to the closest patient — one person's
     * treatment notes in another's file is a clinical error, not a tidiness
     * one. But it must not become a new patient either: if it is a misspelling
     * of someone SUMIT already knows, that creates a second record for a
     * person who has one, and duplicate patients are how a clinic loses track
     * of a history.
     *
     * Both wrong answers are avoidable by not answering. It goes to review.
     */
    review.push({
      file: entry.file,
      year: entry.year,
      closestExistingPatient: people.get(best.key)?.name ?? null,
      editDistance: best.dist,
    })
    continue
  }

  upsert(key, (cur) => ({
    name: cur.name ?? entry.file.replace(/\.pdf$/i, "").trim(),
    driveFiles: [...cur.driveFiles, entry.file],
    latestYear: Math.max(cur.latestYear, entry.year),
    sources: cur.sources.add("drive"),
  }))
}

/*
 * Scope. Anyone SUMIT knows is in — their record is a financial one and the
 * export carries no date to filter on. Drive-only people are in when a file of
 * theirs is from EARLIEST_YEAR or later, which is the rule the clinic gave.
 */
const selected = []
const skipped = []
for (const [key, p] of people) {
  const fromSumit = p.sources.has("sumit")
  const recentEnough = p.latestYear >= EARLIEST_YEAR
  if (fromSumit || recentEnough) selected.push({ key, ...p })
  else skipped.push({ key, ...p })
}

console.log(`SUMIT people           : ${[...people.values()].filter((p) => p.sources.has("sumit")).length}`)
console.log(`Drive files            : ${drive.length}`)
console.log(`distinct people        : ${people.size}`)
console.log(`  selected for import  : ${selected.length}`)
console.log(`  skipped (pre-${EARLIEST_YEAR}) : ${skipped.length}`)
console.log(`with an email          : ${selected.filter((p) => p.email).length}`)
console.log(`with a treatment file  : ${selected.filter((p) => p.driveFiles.length).length}`)
console.log(`in both sources        : ${selected.filter((p) => p.sources.size === 2).length}`)
console.log(`near matches to review : ${review.length}`)

/*
 * Outside the repository, deliberately.
 *
 * This file is a list of patient names. The repository is on GitHub, and a
 * default `git add -A` does not ask whether a file is sensitive — so the
 * output goes somewhere git will never see it, rather than relying on an
 * ignore rule that a future `--force` or a moved directory would defeat.
 */
const reviewPath =
  process.env.IMPORT_REVIEW_PATH ?? resolve(ROOT, "..", "onemanband-import-review.json")
writeFileSync(reviewPath, JSON.stringify(review, null, 1), "utf8")
console.log(`\nnear matches written to ${reviewPath} (outside the repo — it names patients)`)

/*
 * The people left out, so a human can disagree with the rule.
 *
 * Every one of them is a patient the clinic treated at some point; they are
 * excluded because nothing about them is recent, not because they are not
 * real. That is a judgement worth being able to check.
 */
const skippedPath = resolve(ROOT, "..", "onemanband-import-skipped.json")
writeFileSync(
  skippedPath,
  JSON.stringify(
    skipped
      .map((p) => ({
        name: p.name,
        lastFileYear: p.latestYear || null,
        files: p.driveFiles.length,
        inSumit: p.sources.has("sumit"),
      }))
      .sort((a, b) => (b.lastFileYear ?? 0) - (a.lastFileYear ?? 0)),
    null,
    1,
  ),
  "utf8",
)
console.log(`skipped patients written to ${skippedPath} (${skipped.length})`)

/* ---------------------------------------------------------------- write --- */

if (!WRITE) {
  console.log("\nDry run. Nothing was written. Re-run with --write to insert.")
  process.exit(0)
}

const clinic = await fetch(`${SUPABASE}/rest/v1/clinics?select=id&limit=1`, {
  headers: REST,
}).then((r) => r.json())
const clinicId = clinic[0]?.id
if (!clinicId) throw new Error("no clinic row to import into")

const existing = await fetch(`${SUPABASE}/rest/v1/patients?select=id`, {
  headers: REST,
}).then((r) => r.json())
if (existing.length) {
  throw new Error(
    `patients table already has ${existing.length} rows — refusing to import on top of them`,
  )
}

const rows = selected.map((p) => ({
  clinic_id: clinicId,
  full_name: p.name,
  email: p.email,
  status: "active",
  medical_history_summary: "",
  general_notes: "",
  tags: [...p.sources],
  import_source: {
    sumitNames: p.sumitNames,
    driveFiles: p.driveFiles,
    latestYear: p.latestYear || null,
    importedAt: new Date().toISOString(),
  },
}))

let inserted = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const res = await fetch(`${SUPABASE}/rest/v1/patients`, {
    method: "POST",
    headers: { ...REST, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(chunk),
  })
  if (!res.ok) {
    console.error(`chunk at ${i} failed: HTTP ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  inserted += chunk.length
  console.log(`inserted ${inserted}/${rows.length}`)
}

console.log("done")
