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
  // Where every document goes while this deploy is not filing live. A draft is
  // still a real API call against a real company account, and SUMIT mails the
  // address we hand it — so mock patients must never be a delivery target.
  BILLING_TEST_EMAIL: z.string().email().optional(),
  // Twilio — WhatsApp and SMS delivery. Server-only: the secret can send in the
  // clinic's name and is billed per message. An API key pair is used rather
  // than the account's auth token so it can be revoked on its own.
  TWILIO_ACCOUNT_SID: z.string().startsWith("AC").optional(),
  TWILIO_API_KEY_SID: z.string().startsWith("SK").optional(),
  TWILIO_API_KEY_SECRET: z.string().min(1).optional(),
  // Sender, WhatsApp-prefixed: `whatsapp:+14155238886` for the sandbox, the
  // clinic's own number once Meta has approved it.
  TWILIO_WHATSAPP_FROM: z.string().startsWith("whatsapp:").optional(),
  /** Plain sender for SMS, if the fallback lane is ever switched on. */
  TWILIO_SMS_FROM: z.string().optional(),
  // Resend — email delivery. Server-only.
  RESEND_API_KEY: z.string().min(1).optional(),
  // Until a domain is verified with Resend, the only usable sender is
  // `onboarding@resend.dev`, and it can only reach the account owner.
  RESEND_FROM: z.string().optional(),
})

/**
 * A blank line in an env file means "not set", not "set to empty".
 *
 * `.env.local` is edited by hand, and a placeholder like `SUMIT_API_KEY=` is
 * the normal state of a key that has not been pasted in yet. dotenv reports
 * that as `""`, which would fail `.min(1)` and take the whole app down at
 * import time — so an empty value is normalised to absent, and the feature
 * simply stays switched off.
 */
function unset(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined
}

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: unset(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: unset(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
})

export const serverEnv = serverEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: unset(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: unset(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: unset(process.env.SUPABASE_SERVICE_ROLE_KEY),
  APP_ENCRYPTION_KEY: unset(process.env.APP_ENCRYPTION_KEY),
  SUMIT_COMPANY_ID: unset(process.env.SUMIT_COMPANY_ID),
  SUMIT_API_KEY: unset(process.env.SUMIT_API_KEY),
  SUMIT_LIVE_DOCUMENTS: unset(process.env.SUMIT_LIVE_DOCUMENTS),
  BILLING_TEST_EMAIL: unset(process.env.BILLING_TEST_EMAIL),
  TWILIO_ACCOUNT_SID: unset(process.env.TWILIO_ACCOUNT_SID),
  TWILIO_API_KEY_SID: unset(process.env.TWILIO_API_KEY_SID),
  TWILIO_API_KEY_SECRET: unset(process.env.TWILIO_API_KEY_SECRET),
  TWILIO_WHATSAPP_FROM: unset(process.env.TWILIO_WHATSAPP_FROM),
  TWILIO_SMS_FROM: unset(process.env.TWILIO_SMS_FROM),
  RESEND_API_KEY: unset(process.env.RESEND_API_KEY),
  RESEND_FROM: unset(process.env.RESEND_FROM),
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
