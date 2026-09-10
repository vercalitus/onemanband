/**
 * The dev server with no clinic behind it.
 *
 *   npm run dev:mock        # http://localhost:3001
 *
 * The app has one switch for this already: with `NEXT_PUBLIC_SUPABASE_*`
 * absent there is no auth wall and no live query, and every screen falls back
 * to the demo dataset (see `isSupabaseConfigured` in src/lib/env.ts). What was
 * missing was a way to reach that state without moving `.env.local` out of the
 * way, which is a thing to forget to undo.
 *
 * The vars are set to the empty string rather than deleted, and that is the
 * whole trick: Next skips any key already present in `process.env` when it
 * loads `.env.local`, so an empty value is what stops the real credentials
 * being read at all. `unset()` in src/lib/env.ts then reads "" as absent.
 *
 * Use it to look at UI. It cannot tell you anything about production data,
 * because it is not connected to any.
 */
import { spawn } from "node:child_process"
import { createRequire } from "node:module"

// Next's own entry, run by this Node rather than through `npx`: current Node
// refuses to spawn a .cmd shim without a shell, and a shell is one more thing
// to quote correctly on two platforms.
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next")

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--port", process.env.PORT ?? "3001"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
)

child.on("exit", (code) => process.exit(code ?? 0))
