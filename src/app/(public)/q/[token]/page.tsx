import { QuestionnairePageClient } from "@/features/automations/components/questionnaire-page-client"

/** Periodic progress questionnaire; answers land in the patient's timeline. */
export const metadata = { robots: { index: false, follow: false } }

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <QuestionnairePageClient token={token} />
}
