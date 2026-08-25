import {
  SimulatedBillingProvider,
  type BillingProvider,
} from "@/features/finances/lib/billing-provider"
import { SumitBillingProvider } from "@/features/finances/lib/sumit-provider"
import { isSumitConfigured, sumitIssuesLiveDocuments } from "@/lib/sumit/client"
import { isSupabaseConfigured } from "@/lib/env"

/**
 * Which provider files documents on this deploy. **Server-only** — importing
 * this from a client component would pull the SUMIT transport into the browser
 * bundle.
 *
 * Same switch as `isSupabaseConfigured()`: absent credentials mean the app
 * runs simulated rather than broken.
 */
export function getBillingProvider(): BillingProvider {
  return isSumitConfigured() ? new SumitBillingProvider() : new SimulatedBillingProvider()
}

/**
 * Whether this deploy may file numbered, legally binding documents.
 *
 * Two locks, both of which have to be open:
 *
 * 1. `SUMIT_LIVE_DOCUMENTS=1` — a deliberate switch, because SUMIT has no
 *    sandbox and the development account is the filing account.
 * 2. Supabase auth configured — an app with no login must not expose an
 *    endpoint that mints tax invoices. Without it we still file, but as
 *    drafts, which carry no number and no tax event.
 */
export function documentsAreDrafts(): boolean {
  return !sumitIssuesLiveDocuments() || !isSupabaseConfigured()
}
