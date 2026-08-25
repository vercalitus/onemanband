import {
  SimulatedBillingProvider,
  type BillingProvider,
} from "@/features/finances/lib/billing-provider"
import { SumitBillingProvider } from "@/features/finances/lib/sumit-provider"
import { isSumitConfigured, sumitIssuesLiveDocuments } from "@/lib/sumit/client"
import { isSupabaseConfigured } from "@/lib/env"

/**
 * Which provider files documents on this deploy, and whether it may.
 * **Server-only** — importing this from a client component would pull the
 * SUMIT transport into the browser bundle.
 *
 * Same switch as `isSupabaseConfigured()`: absent credentials mean the app
 * runs simulated rather than broken.
 */
export function getBillingProvider(): BillingProvider {
  return isSumitConfigured() ? new SumitBillingProvider() : new SimulatedBillingProvider()
}

export type BillingGate =
  | { allowed: true; drafts: boolean }
  | { allowed: false; reason: string }

/**
 * May this request file anything at all, and if so, as a draft?
 *
 * The refusal case is the one that matters. Filing reaches a real company
 * account: it creates customer cards and — because `SendByEmail` is part of
 * the same call — sends mail from the clinic's name to whatever address the
 * request names. An endpoint that does that must never be reachable without a
 * session, so live credentials plus no auth is a hard stop, not a downgrade
 * to drafts. Drafts are a safeguard against filing the wrong document, not
 * against a stranger driving the account.
 *
 * With no credentials configured there is nothing to protect: the simulated
 * provider touches nothing outside this process, and the app stays usable.
 *
 * The two locks on a numbered, legally binding document:
 *   1. `SUMIT_LIVE_DOCUMENTS=1` — deliberate, because SUMIT has no sandbox and
 *      the development account is the filing account.
 *   2. Supabase auth configured — enforced above as a refusal.
 */
export function billingGate(): BillingGate {
  if (isSumitConfigured() && !isSupabaseConfigured()) {
    return {
      allowed: false,
      reason:
        "Billing credentials are configured but authentication is not. Refusing to expose document issuing without a login.",
    }
  }
  return { allowed: true, drafts: !sumitIssuesLiveDocuments() }
}
