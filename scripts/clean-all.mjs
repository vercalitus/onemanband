/**
 * Aggressive dev cache wipe — fixes stale Next chunks (e.g. missing 611.js) on Windows
 * when antivirus / sync / multiple node processes race the .next folder.
 */
import fs from "node:fs"
import path from "node:path"

const roots = [".next", path.join("node_modules", ".cache")]

for (const rel of roots) {
  try {
    fs.rmSync(rel, { recursive: true, force: true })
    console.log(`removed ${rel}`)
  } catch {
    // ignore
  }
}
