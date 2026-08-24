"use client"

import { useCallback, useEffect } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  AUTOMATION_STORE_EVENT,
  isQuestionnaireFiled,
  listQuestionnaires,
  markQuestionnaireFiled,
} from "@/features/automations/lib/automation-store"
import { questionnaireToTreatmentRecord } from "@/features/automations/lib/questionnaire"
import { addTreatmentRecord } from "@/features/patients/lib/patient-extras-store"
import { readClinicSettings } from "@/lib/clinic-settings-storage"

/**
 * Files completed progress questionnaires into the patient's timeline.
 *
 * The spec requires the answers to land back in the patient file marked as
 * "Progress", not merely to be collected. Filing happens on the clinic side —
 * the public questionnaire page records the answers but never writes clinical
 * records itself, which keeps an unauthenticated page out of the chart.
 *
 * Runs whenever the clinic app is open and re-runs on every store change, so a
 * questionnaire returned while the practitioner is working shows up without a
 * reload. Idempotent via `filedQuestionnaires`.
 */
export function useQuestionnaireFiling() {
  const { t } = useLocale()

  const file = useCallback(() => {
    try {
      const practitioner = readClinicSettings().profile.practitionerName || ""
      for (const questionnaire of listQuestionnaires()) {
        if (!questionnaire.completedAt) continue
        if (isQuestionnaireFiled(questionnaire.id)) continue

        const record = questionnaireToTreatmentRecord(questionnaire, (key) => t(key), practitioner)
        addTreatmentRecord(questionnaire.patientId, record)
        markQuestionnaireFiled(questionnaire.id)
      }
    } catch {
      // Filing is best-effort; never break the app shell over it.
    }
    // `t` is locale-bound, so the record is written in the practitioner's
    // current language rather than whatever the patient answered in.
  }, [t])

  useEffect(() => {
    file()
    window.addEventListener(AUTOMATION_STORE_EVENT, file)
    return () => window.removeEventListener(AUTOMATION_STORE_EVENT, file)
  }, [file])
}
