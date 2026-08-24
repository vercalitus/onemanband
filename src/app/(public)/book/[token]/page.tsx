import { BookPageClient } from "@/features/automations/components/book-page-client"

/**
 * Patient self-registration + first booking, reached from an invite link.
 * The token is the entire authorisation — see features/automations/lib/tokens.ts.
 */
export const metadata = { robots: { index: false, follow: false } }

export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <BookPageClient token={token} />
}
