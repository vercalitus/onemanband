import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  documentsAreDrafts,
  getBillingProvider,
} from "@/features/finances/lib/provider-registry"
import {
  validateTaxDocument,
  type TaxDocumentRequest,
} from "@/features/finances/lib/plan-tax-document"

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
 * Access: gated by the Supabase session in `lib/supabase/middleware.ts` once
 * auth is configured. Until it is, `documentsAreDrafts()` forces drafts, so an
 * unauthenticated deploy cannot mint a numbered invoice.
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

export async function POST(request: NextRequest) {
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
  const document: TaxDocumentRequest = { ...parsed.data, draft: documentsAreDrafts() }

  const problem = validateTaxDocument(document)
  if (problem) {
    return NextResponse.json({ ok: false, message: problem }, { status: 400 })
  }

  const provider = getBillingProvider()
  const result = await provider.issue(document)

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        provider: provider.name,
        message: result.message,
        details: result.details,
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
