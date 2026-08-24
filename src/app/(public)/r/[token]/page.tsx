import { RespondPageClient } from "@/features/automations/components/respond-page-client"

/** Confirm / cancel / reschedule landing for reminder action buttons. */
export const metadata = { robots: { index: false, follow: false } }

export default async function RespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <RespondPageClient token={token} />
}
