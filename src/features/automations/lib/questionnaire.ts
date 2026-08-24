import {
  findQuestionnaire,
  randomId,
  upsertQuestionnaire,
} from "@/features/automations/lib/automation-store"
import type {
  ProgressQuestionnaire,
  QuestionnaireAnswer,
  QuestionnaireQuestion,
} from "@/types/automation"
import type { TreatmentRecord } from "@/types/domain"

/**
 * The periodic progress questionnaire.
 *
 * Sent every N completed sessions ahead of a longer review visit. Answers come
 * back as a treatment record tagged "Progress" so they sit in the patient's
 * timeline next to the clinical notes rather than in a separate silo — that
 * placement is the whole point of the feature.
 */

export const PROGRESS_QUESTIONS: QuestionnaireQuestion[] = [
  { id: "pain_now", kind: "scale", labelKey: "questionnaire.q.painNow", required: true },
  { id: "pain_worst", kind: "scale", labelKey: "questionnaire.q.painWorst", required: true },
  {
    id: "change",
    kind: "choice",
    labelKey: "questionnaire.q.change",
    optionKeys: [
      "questionnaire.opt.muchBetter",
      "questionnaire.opt.better",
      "questionnaire.opt.same",
      "questionnaire.opt.worse",
    ],
    required: true,
  },
  { id: "function", kind: "scale", labelKey: "questionnaire.q.function", required: true },
  { id: "sleep", kind: "scale", labelKey: "questionnaire.q.sleep" },
  { id: "exercises", kind: "choice", labelKey: "questionnaire.q.exercises", optionKeys: [
    "questionnaire.opt.always",
    "questionnaire.opt.sometimes",
    "questionnaire.opt.rarely",
    "questionnaire.opt.never",
  ] },
  { id: "concerns", kind: "text", labelKey: "questionnaire.q.concerns" },
  { id: "goal", kind: "text", labelKey: "questionnaire.q.goal" },
]

/** Scale questions run 0–10; the UI renders them as a row of buttons. */
export const SCALE_MIN = 0
export const SCALE_MAX = 10

export function createQuestionnaire(
  patientId: string,
  patientName: string,
  sessionNumber: number,
): ProgressQuestionnaire {
  const questionnaire: ProgressQuestionnaire = {
    id: randomId("pq"),
    patientId,
    patientName,
    sessionNumber,
    createdAt: new Date().toISOString(),
    answers: [],
  }
  upsertQuestionnaire(questionnaire)
  return questionnaire
}

export function submitQuestionnaire(
  id: string,
  answers: QuestionnaireAnswer[],
): ProgressQuestionnaire | null {
  const existing = findQuestionnaire(id)
  if (!existing) return null
  const completed: ProgressQuestionnaire = {
    ...existing,
    answers,
    completedAt: new Date().toISOString(),
  }
  upsertQuestionnaire(completed)
  return completed
}

/** True when every `required` question has a non-empty answer. */
export function isComplete(answers: QuestionnaireAnswer[]): boolean {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]))
  return PROGRESS_QUESTIONS.filter((q) => q.required).every((q) => {
    const value = byId.get(q.id)
    return value !== undefined && value !== ""
  })
}

/**
 * Fold a completed questionnaire into a timeline entry for the patient file.
 * `t` renders the question labels in the practitioner's locale — the patient
 * may have answered in a different one.
 */
export function questionnaireToTreatmentRecord(
  questionnaire: ProgressQuestionnaire,
  t: (key: string) => string,
  practitioner: string,
): TreatmentRecord {
  const byId = new Map(questionnaire.answers.map((a) => [a.questionId, a.value]))
  const lines = PROGRESS_QUESTIONS.map((q) => {
    const raw = byId.get(q.id)
    if (raw === undefined || raw === "") return null
    const value = q.kind === "choice" ? t(raw) : raw
    return `${t(q.labelKey)}: ${value}`
  }).filter(Boolean) as string[]

  return {
    id: `tr-${questionnaire.id}`,
    recordedAt: questionnaire.completedAt ?? questionnaire.createdAt,
    practitioner,
    title: `${t("questionnaire.recordTitle")} · ${t("questionnaire.session")} ${questionnaire.sessionNumber}`,
    note: lines.join("\n"),
  }
}
