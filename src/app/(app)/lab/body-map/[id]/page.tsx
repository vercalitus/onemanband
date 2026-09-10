import { BodyMapLabClient } from "./body-map-lab-client"

/**
 * Prototype. Deliberately off to one side of the app, at `/lab`, so trying it
 * cannot touch a patient's chart: nothing here writes to `patients`, and the
 * annotations live in this browser until the idea is judged worth keeping.
 */
export default async function BodyMapLabPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BodyMapLabClient patientId={id} />
}
