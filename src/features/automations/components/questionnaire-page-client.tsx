"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { PublicNotice, PublicShell } from "@/features/automations/components/public-shell"
import { markTokenUsed } from "@/features/automations/lib/automation-store"
import { recordPatientResponse } from "@/features/automations/lib/events"
import {
  isComplete,
  PROGRESS_QUESTIONS,
  SCALE_MAX,
  SCALE_MIN,
  submitQuestionnaire,
} from "@/features/automations/lib/questionnaire"
import { findQuestionnaire } from "@/features/automations/lib/automation-store"
import { resolveToken } from "@/features/automations/lib/tokens"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { cn } from "@/lib/utils"
import type { ProgressQuestionnaire, QuestionnaireAnswer } from "@/types/automation"

type Stage = "loading" | "invalid" | "form" | "done"

/**
 * The progress questionnaire a patient fills in before a longer review visit.
 *
 * Single-use by design — the answers become a dated entry in the clinical
 * timeline, and a questionnaire that could be re-submitted would quietly
 * rewrite history.
 */
export function QuestionnairePageClient({ token }: { token: string }) {
  const { t } = useLocale()
  const [stage, setStage] = useState<Stage>("loading")
  const [reason, setReason] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [questionnaire, setQuestionnaire] = useState<ProgressQuestionnaire | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState("")

  useEffect(() => {
    setClinicName(readClinicSettings().profile.clinicName)
    const resolution = resolveToken(token, "questionnaire")
    if (!resolution.ok) {
      setReason(resolution.reason)
      setStage("invalid")
      return
    }
    const found = resolution.token.questionnaireId
      ? findQuestionnaire(resolution.token.questionnaireId)
      : null
    if (!found) {
      setReason("unknown")
      setStage("invalid")
      return
    }
    if (found.completedAt) {
      setReason("used")
      setStage("invalid")
      return
    }
    setQuestionnaire(found)
    setStage("form")
  }, [token])

  const answers = useMemo<QuestionnaireAnswer[]>(
    () => Object.entries(values).map(([questionId, value]) => ({ questionId, value })),
    [values],
  )

  const submit = () => {
    if (!questionnaire) return
    if (!isComplete(answers)) {
      setError(t("public.questionnaire.errorRequired"))
      return
    }
    submitQuestionnaire(questionnaire.id, answers)
    recordPatientResponse({
      kind: "questionnaire",
      patientId: questionnaire.patientId,
      patientName: questionnaire.patientName,
      questionnaireId: questionnaire.id,
    })
    markTokenUsed(token)
    setStage("done")
  }

  if (stage === "loading") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.questionnaire.title")}>
        <div className="flex items-center gap-2 text-[17px] text-mute">
          <Loader2 className="size-5 animate-spin text-cobalt" aria-hidden />
          {t("public.loading")}
        </div>
      </PublicShell>
    )
  }

  if (stage === "invalid") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.questionnaire.title")}>
        <PublicNotice
          tone="error"
          title={t(`public.token.${reason}`)}
          body={t("public.token.contactClinic")}
        />
      </PublicShell>
    )
  }

  if (stage === "done") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.questionnaire.title")}>
        <PublicNotice
          tone="success"
          title={t("public.questionnaire.doneTitle")}
          body={t("public.questionnaire.doneBody")}
        />
      </PublicShell>
    )
  }

  return (
    <PublicShell
      clinicName={clinicName}
      title={t("public.questionnaire.title")}
      subtitle={t("public.questionnaire.subtitle", {
        session: questionnaire?.sessionNumber ?? 0,
      })}
    >
      <div className="space-y-5">
        <div className="divide-y divide-hair-soft rounded-md border border-hair bg-paper">
        {PROGRESS_QUESTIONS.map((question) => (
          <div key={question.id} className="px-4 py-5 sm:px-5">
            <p className="mb-3 text-[17px] leading-snug font-bold text-ink">
              {t(question.labelKey)}
              {question.required ? <span aria-hidden> *</span> : null}
            </p>

            {question.kind === "scale" ? (
              <ScaleInput
                value={values[question.id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [question.id]: v }))}
                ariaLabel={t(question.labelKey)}
              />
            ) : question.kind === "choice" ? (
              <div className="flex flex-wrap gap-2">
                {(question.optionKeys ?? []).map((optionKey) => (
                  <button
                    key={optionKey}
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, [question.id]: optionKey }))}
                    aria-pressed={values[question.id] === optionKey}
                    className={cn(
                      "min-h-12 rounded-md border px-4 text-[17px] transition-colors",
                      values[question.id] === optionKey
                        ? "border-cobalt bg-cobalt font-bold text-white"
                        : "border-hair bg-paper font-medium text-ink hover:bg-sunk",
                    )}
                  >
                    {t(optionKey)}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                rows={3}
                value={values[question.id] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [question.id]: e.target.value }))}
                aria-label={t(question.labelKey)}
                className="w-full rounded-md border border-hair bg-paper px-3 py-2.5 text-[17px] leading-relaxed text-ink outline-none focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/20"
              />
            )}
          </div>
        ))}
        </div>

        {error ? (
          <p
            className="rounded-md border border-signal bg-signal-tint px-3 py-2 text-[17px] text-ink"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Button size="lg" className="w-full" onClick={submit}>
          {t("public.questionnaire.submit")}
        </Button>
        <p className="text-sm leading-relaxed text-mute">
          {t("public.questionnaire.privacy")}
        </p>
      </div>
    </PublicShell>
  )
}

/** 0–10 rating as a tappable row — no slider, which is fiddly on a phone. */
function ScaleInput({
  value,
  onChange,
  ariaLabel,
}: {
  value?: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const { t } = useLocale()
  const options = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i)

  return (
    <div role="radiogroup" aria-label={ariaLabel}>
      {/* Six to a row on a phone: eleven 44px targets do not fit on one line. */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === String(n)}
            onClick={() => onChange(String(n))}
            className={cn(
              "h-12 rounded-md border text-[17px] tabular-nums transition-colors",
              value === String(n)
                ? "border-cobalt bg-cobalt font-bold text-white"
                : "border-hair bg-paper font-medium text-ink hover:bg-sunk",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-sm text-mute">
        <span>{t("questionnaire.scale.low")}</span>
        <span>{t("questionnaire.scale.high")}</span>
      </div>
    </div>
  )
}
