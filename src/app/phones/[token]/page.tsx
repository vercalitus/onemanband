import type { Metadata } from "next"

import { PhonesClient } from "./phones-client"

/**
 * The practitioner's own link for filling in missing phone numbers.
 *
 * Public, like the patient pages: the token in the path is the authorisation,
 * checked on every API call behind it. Not indexed, because a list of patient
 * names has no business in a search engine.
 */

export const metadata: Metadata = {
  title: "Missing phone numbers",
  robots: { index: false, follow: false },
}

export default async function PhonesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PhonesClient token={token} />
}
