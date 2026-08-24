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
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin text-sky-600" aria-hidden />
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
      <div className="space-y-4">
        {PROGRESS_QUESTIONS.map((question) => (
          <div
            key={question.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="mb-3 text-sm font-semibold text-slate-900">
              {t(question.labelKey)}
              {question.required ? <span className="text-[rgb(171,119,93)]"> *</span> : null}
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
                    className={cn(
                      "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                      values[question.id] === optionKey
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-300",
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
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            )}
          </div>
        ))}

        {error ? (
          <p className="text-sm font-medium text-[rgb(171,119,93)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button className="h-11 w-full text-base" onClick={submit}>
          {t("public.questionnaire.submit")}
        </Button>
        <p className="text-xs leading-relaxed text-slate-500">
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
      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === String(n)}
            onClick={() => onChange(String(n))}
            className={cn(
              "size-9 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
              value === String(n)
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-sky-300",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
        <span>{t("questionnaire.scale.low")}</span>
        <span>{t("questionnaire.scale.high")}</span>
      </div>
    </div>
  )
}
