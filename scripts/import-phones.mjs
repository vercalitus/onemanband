/**
 * Fill in patient phone numbers from the practitioner's own address book.
 *
 *   node scripts/import-phones.mjs            # dry run
 *   node scripts/import-phones.mjs --write    # fill them in
 *
 * The address book is personal — family, suppliers and friends are in it too —
 * so the join runs one way only: each *patient* is looked up in the contacts,
 * never the reverse. A contact matching nobody is simply not a patient, and is
 * left where it is. Nothing here creates a patient.
 *
 * Only an exact name match resolving to a single number is written. A name that
 * matches two different numbers, or matches only approximately, is left for a
 * person: a wrong number on a patient record sends their appointment reminders,
 * and eventually their treatment details, to a stranger.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const WRITE = process.argv.includes("--write")
const VCF =
  process.env.CONTACTS_VCF ?? "C:/Users/verca/Downloads/outlook_contacts_for_icloud.vcf"

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)
const B = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}` }

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

function editDistance(a, b) {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

/** E.164, the only form WhatsApp accepts. Israeli local numbers lose the zero. */
function toE164(raw) {
  const d = (raw ?? "").replace(/[^\d+]/g, "")
  if (!d) return null
  if (d.startsWith("+")) return /^\+\d{9,15}$/.test(d) ? d : null
  if (d.startsWith("00")) return toE164(`+${d.slice(2)}`)
  if (d.startsWith("972")) return `+${d}`
  if (d.startsWith("0")) return `+972${d.slice(1)}`
  return null
}

const buf = readFileSync(VCF)
const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf)
const text =
  (utf8.match(/\uFFFD/g) ?? []).length > 20
    ? new TextDecoder("windows-1255").decode(buf)
    : utf8

const byKey = new Map()
for (const block of text.split(/BEGIN:VCARD/i).slice(1)) {
  const b = block.replace(/\r?\n[ \t]/g, "")
  const one = (p) => (b.match(new RegExp(`^${p}[^:\\r\\n]*:(.*)$`, "im")) ?? ["", ""])[1].trim()
  const name = one("FN") || one("N").split(";").filter(Boolean).reverse().join(" ")
  const phones = [...b.matchAll(/^TEL[^:\r\n]*:(.*)$/gim)]
    .map((m) => toE164(m[1].trim()))
    .filter(Boolean)
  const key = nameKey(name)
  if (!key || !phones.length) continue
  if (!byKey.has(key)) byKey.set(key, new Set())
  for (const p of phones) byKey.get(key).add(p)
}

const patients = []
for (let from = 0; ; from += 1000) {
  const page = await fetch(
    `${B}/rest/v1/patients?select=id,full_name,phone,import_source&order=id&offset=${from}&limit=1000`,
    { headers: H },
  ).then((r) => r.json())
  patients.push(...page)
  if (page.length < 1000) break
}

const fill = []
const ambiguous = []
const near = []
const contactKeys = [...byKey.keys()]

for (const p of patients) {
  if (p.phone) continue
  const candidates = [p.full_name, ...(p.import_source?.sumitNames ?? [])].map(nameKey)
  const hit = candidates.find((k) => byKey.has(k))

  if (hit) {
    const numbers = [...byKey.get(hit)]
    if (numbers.length === 1) fill.push({ id: p.id, name: p.full_name, phone: numbers[0] })
    else ambiguous.push({ patient: p.full_name, numbers: numbers.length })
    continue
  }

  const primary = nameKey(p.full_name)
  let best = { key: null, dist: Infinity }
  for (const k of contactKeys) {
    const d = editDistance(primary, k)
    if (d < best.dist) best = { key: k, dist: d }
  }
  const longer = Math.max(primary.length, best.key?.length ?? 0)
  if (best.dist <= 2 || (longer && best.dist / longer <= 0.2)) {
    near.push({ patient: p.full_name, contact: best.key, distance: best.dist })
  }
}

const mobile = fill.filter((f) => /^\+9725\d{8}$/.test(f.phone)).length
console.log(`patients without a phone : ${patients.filter((p) => !p.phone).length}`)
console.log(`certain, will be filled  : ${fill.length}  (${mobile} mobile, ${fill.length - mobile} not)`)
console.log(`same name, several numbers: ${ambiguous.length}  left alone`)
console.log(`near match only          : ${near.length}  left alone`)

const reviewPath = resolve(ROOT, "..", "onemanband-phone-review.json")
writeFileSync(reviewPath, JSON.stringify({ ambiguous, near }, null, 1), "utf8")
console.log(`\nleft for a person: ${reviewPath} (outside the repo — it names patients)`)

if (!WRITE) {
  console.log("\nDry run. Nothing written. Re-run with --write.")
  process.exit(0)
}

let done = 0
for (const f of fill) {
  const r = await fetch(`${B}/rest/v1/patients?id=eq.${f.id}`, {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ phone: f.phone }),
  })
  if (r.ok) done++
  else console.error(`failed for one patient: HTTP ${r.status}`)
}
console.log(`\nfilled ${done}/${fill.length}`)
