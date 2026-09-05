import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { billingGate, getBillingProvider } from "@/features/finances/lib/provider-registry"
import {
  validateTaxDocument,
  type TaxDocumentRequest,
} from "@/features/finances/lib/plan-tax-document"
import { serverEnv } from "@/lib/env"

/**
 * File a tax document with the clinic's bookkeeping provider.
 *
 * The document is planned in the browser (`plan-tax-document.ts` is pure and
 * runs anywhere) and filed here, because filing needs the private API key and
 * that key must never reach a browser.
 *
 * Two things are decided server-side and cannot be talked out of by the
 * request body: whether the document is a draft, and which provider files it.
 *
 * Access: gated by the Supabase session in `lib/supabase/middleware.ts`, and
 * `billingGate()` refuses outright if billing credentials exist while auth
 * does not — filing sends mail from the clinic's account, so it must never be
 * reachable without a session.
 *
 * Cross-site POSTs are covered by the session cookie's SameSite=Lax: a form
 * submitted from another origin arrives without it and fails the gate above.
 */

export const dynamic = "force-dynamic"

const customerSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
})

const bodySchema = z.object({
  kind: z.enum(["invoice_receipt", "credit_invoice_receipt", "payment_request"]),
  externalReference: z.string().min(1),
  customer: customerSchema,
  items: z.array(itemSchema).min(1),
  payment: z
    .object({
      amount: z.number().positive(),
      method: z.enum(["cash", "bank_transfer", "cheque", "credit_card", "digital"]),
    })
    .optional(),
  vatIncluded: z.boolean(),
  emailTo: z.string().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.enum(["he", "en", "ar"]),
  originalDocumentId: z.string().optional(),
  description: z.string().optional(),
})

/**
 * Redirect document delivery away from patients while this deploy is testing.
 *
 * A draft is not a dry run: it is a real call against the clinic's real SUMIT
 * account, and SUMIT mails whatever address it is handed, from the clinic's
 * own name. The dataset behind these tests is mock patients with made-up
 * addresses, so an unredirected draft is a stranger receiving a tax document.
 *
 * `BILLING_TEST_EMAIL` names the one person allowed to receive test documents.
 * With no such address configured, delivery is suppressed entirely rather than
 * left to chance — the document is still created, it just is not posted.
 *
 * Live filing (`SUMIT_LIVE_DOCUMENTS=1`) passes through untouched: at that
 * point the patient is the correct recipient.
 */
function withTestDelivery(document: TaxDocumentRequest): TaxDocumentRequest {
  if (!document.draft) return document
  const tester = serverEnv.BILLING_TEST_EMAIL
  return {
    ...document,
    emailTo: tester,
    // Also on the customer card, which SUMIT stores and can mail later.
    customer: { ...document.customer, email: tester },
  }
}

export async function POST(request: NextRequest) {
  const gate = billingGate()
  if (!gate.allowed) {
    console.error(`[billing] refused: ${gate.reason}`)
    return NextResponse.json(
      { ok: false, message: "Document issuing is not available on this deploy." },
      { status: 503 },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "invalid document", details: parsed.error.message },
      { status: 400 },
    )
  }

  // `draft` is not read from the body on purpose — the deploy decides whether
  // it is allowed to create a legally numbered document, not the caller.
  const document: TaxDocumentRequest = withTestDelivery({
    ...parsed.data,
    draft: gate.drafts,
  })

  const problem = validateTaxDocument(document)
  if (problem) {
    return NextResponse.json({ ok: false, message: problem }, { status: 400 })
  }

  const provider = getBillingProvider()
  const result = await provider.issue(document)

  if (!result.ok) {
    // Provider internals stay in the server log. `message` is the part written
    // for a human; `details` can carry stack traces or an error page, and
    // neither belongs in a response the browser can read.
    if (result.details) {
      console.error(`[billing] ${provider.name} rejected filing: ${result.details}`)
    }
    return NextResponse.json(
      {
        ok: false,
        provider: provider.name,
        message: result.message,
        safeToRetry: result.safeToRetry,
      },
      // 502 when the provider failed us, 422 when it refused us.
      { status: result.safeToRetry ? 422 : 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    provider: provider.name,
    live: provider.live,
    document: result.document,
  })
}
