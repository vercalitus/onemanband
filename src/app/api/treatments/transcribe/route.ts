import Anthropic from "@anthropic-ai/sdk"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

/**
 * Read the handwriting on a session canvas and return it as text.
 *
 * Session-gated by the middleware. Called once, at the moment a session is
 * closed, so the typed note on the record carries what the pen wrote — the
 * image is kept too; this is the searchable, readable copy beside it. The
 * transcription is labelled as automatic where it is stored, and a wrong
 * reading is a wrong reading of a record that still shows the original.
 *
 * Without a key on the deploy this answers "not configured" and the session
 * closes exactly as before, with the image alone.
 */

export const dynamic = "force-dynamic"

/** A canvas PNG is small; anything past this is not one. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

const bodySchema = z.object({ image: z.string().min(1) })

const PROMPT = [
  "This image is a clinician's handwritten note from a chiropractic session, written on a dotted canvas.",
  "Transcribe the handwriting exactly as written, keeping the original language (Hebrew or English) and line breaks.",
  "Do not summarise, translate, correct, or add anything. Where a word is illegible write [?].",
  "Reply with the transcription only. If there is nothing legible, reply with an empty line.",
].join(" ")

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, reason: "not configured" })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success || parsed.data.image.length > (MAX_IMAGE_BYTES * 4) / 3) {
    return NextResponse.json({ ok: false, reason: "invalid image" }, { status: 400 })
  }

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: parsed.data.image },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    })

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, reason: "refused" })
    }
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim()
    return NextResponse.json({ ok: true, text })
  } catch (error) {
    const reason = error instanceof Anthropic.APIError ? `${error.status}: ${error.message}` : "failed"
    console.error(`[treatments/transcribe] ${reason}`)
    return NextResponse.json({ ok: false, reason }, { status: 502 })
  }
}
