/**
 * Backfill each patient's last known visit date.
 *
 *   node scripts/backfill-last-seen.mjs           # dry run
 *   node scripts/backfill-last-seen.mjs --write
 *
 * Source is the bookkeeping account's document history: most patients here pay
 * at the session, so the date of their last document is a good approximation
 * of their last visit — and for the years before this app existed it is the
 * only evidence there is.
 *
 * It writes a floor, not an answer. Real appointments and payments overtake it
 * as they accumulate, and the imported value quietly stops mattering.
 *
 * Reads SUMIT's exported CSV. Nothing is sent to SUMIT.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const WRITE = process.argv.includes("--write")

const DOCUMENTS_CSV =
  process.env.SUMIT_DOCUMENTS_CSV ??
  "C:/Users/verca/Downloads/Table_1726637126_2334241912_202609061926.csv"

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

/** SUMIT exports Hebrew in the legacy Windows codepage. */
function loadCsv(path) {
  const text = new TextDecoder("windows-1255").decode(readFileSync(path))
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const split = (line) => {
    const out = []
    let cur = ""
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
      } else if (c === "," && !q) { out.push(cur); cur = "" } else cur += c
    }
    out.push(cur)
    return out
  }
  const header = split(lines[0])
  return { header, rows: lines.slice(1).map(split) }
}

/** Same normalisation the import used, so the two agree on who is who. */
const nameKey = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ")

const docs = loadCsv(DOCUMENTS_CSV)
const iCustomer = docs.header.indexOf("לקוח/ה")
const iDate = docs.header.indexOf("תאריך")

/** The export prints DD/MM/YYYY. */
const isoDate = (s) => {
  const m = (s ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const latest = new Map()
for (const row of docs.rows) {
  const key = nameKey(row[iCustomer])
  const date = isoDate(row[iDate])
  if (!key || !date) continue
  if (!latest.has(key) || date > latest.get(key)) latest.set(key, date)
}
console.log(`people with a document date: ${latest.size}`)

// Every patient, paged — PostgREST caps a response at 1,000 and says nothing.
const patients = []
for (let from = 0; ; from += 1000) {
  const res = await fetch(
    `${SUPABASE}/rest/v1/patients?select=id,full_name,last_seen_at&order=id&offset=${from}&limit=1000`,
    { headers: REST },
  )
  const page = await res.json()
  patients.push(...page)
  if (page.length < 1000) break
}
console.log(`patients in the database: ${patients.length}`)

const updates = []
let alreadySet = 0
let noDate = 0
for (const p of patients) {
  const date = latest.get(nameKey(p.full_name))
  if (!date) {
    noDate++
    continue
  }
  if (p.last_seen_at === date) {
    alreadySet++
    continue
  }
  updates.push({ id: p.id, last_seen_at: date })
}

console.log(`  would set a date : ${updates.length}`)
console.log(`  already correct  : ${alreadySet}`)
console.log(`  no document ever : ${noDate}`)

if (updates.length) {
  const years = {}
  for (const u of updates) {
    const y = u.last_seen_at.slice(0, 4)
    years[y] = (years[y] ?? 0) + 1
  }
  console.log(`  by year: ${Object.entries(years).sort().map(([y, n]) => `${y}:${n}`).join("  ")}`)
}

if (!WRITE) {
  console.log("\nDry run. Nothing was written. Re-run with --write.")
  process.exit(0)
}

let done = 0
for (const u of updates) {
  const res = await fetch(`${SUPABASE}/rest/v1/patients?id=eq.${u.id}`, {
    method: "PATCH",
    headers: { ...REST, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ last_seen_at: u.last_seen_at }),
  })
  if (!res.ok) {
    console.error(`failed on one row: HTTP ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  done++
  if (done % 100 === 0) console.log(`updated ${done}/${updates.length}`)
}
console.log(`updated ${done}/${updates.length}`)
console.log("done")
