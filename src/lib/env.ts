import { z } from "zod"

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
})

const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Base64-encoded 32-byte key for app-layer field encryption (AES-256-GCM).
  // Server-only. Generate with: openssl rand -base64 32
  APP_ENCRYPTION_KEY: z.string().min(1).optional(),
  // SUMIT bookkeeping. Server-only and deliberately so: the private key can
  // issue tax documents in the clinic's name. Create the pair at
  // app.sumit.co.il/developers/keys/ — the private half is shown once.
  SUMIT_COMPANY_ID: z.coerce.number().int().positive().optional(),
  SUMIT_API_KEY: z.string().min(1).optional(),
  // Off by default. SUMIT has no sandbox, so until this is "1" every document
  // is filed as a draft: no number, no tax event, nothing to credit back.
  SUMIT_LIVE_DOCUMENTS: z.enum(["0", "1"]).optional(),
})

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

export const serverEnv = serverEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  SUMIT_COMPANY_ID: process.env.SUMIT_COMPANY_ID,
  SUMIT_API_KEY: process.env.SUMIT_API_KEY,
  SUMIT_LIVE_DOCUMENTS: process.env.SUMIT_LIVE_DOCUMENTS,
})

/**
 * True only when Supabase auth is configured. When false, the app runs in
 * mock mode: no login wall, no live queries — exactly as it did before auth.
 * This is the single switch that keeps the demo/Vercel deploy working until
 * real Supabase env vars are provided.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
