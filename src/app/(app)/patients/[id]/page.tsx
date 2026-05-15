import { Suspense } from "react"

import { PatientDetailClient } from "./patient-detail-client"

export default function PatientDetailPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">Loading patient…</div>}>
      <PatientDetailClient />
    </Suspense>
  )
}
