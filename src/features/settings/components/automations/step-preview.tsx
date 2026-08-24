"use client"

import { AlertTriangle, Mail, MessageCircle } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  missingPlaceholders,
  renderTemplate,
  TEMPLATE_PLACEHOLDERS,
} from "@/features/automations/lib/template-render"
import type { AutomationStep } from "@/types/automation"

/**
 * Live preview of a step's copy.
 *
 * Editing message templates blind is how a clinic discovers at send time that
 * it wrote `{patient_naem}`. The preview renders the real substitution against
 * a sample patient and calls out anything that will not resolve — the same
 * check the dispatcher applies before delivery, surfaced while there is still
 * someone to fix it.
 */

/** Stand-in values; deliberately obvious so nobody mistakes them for real data. */
const SAMPLE = {
  patient_name: "Maya Green",
  clinic_name: "Serene Spine Clinic",
  practitioner_name: "Dr. Martin",
  date: "28 Aug 2026",
  time: "11:40",
  amount: "₪250",
  link: "https://clinic.example/r/abc123",
  session_number: 6,
}

const KNOWN = new Set<string>(TEMPLATE_PLACEHOLDERS)

export function StepPreview({ step }: { step: AutomationStep }) {
  const { t } = useLocale()

  const rendered = renderTemplate(step.template, SAMPLE)
  // Anything still unresolved is either a typo or a value this step's event
  // cannot supply. Both are bugs the practitioner should see now.
  const unresolved = missingPlaceholders(step.template.body, SAMPLE)
  const unknown = unresolved.filter((p) => !KNOWN.has(p))

  const showsWhatsApp = step.channels.includes("whatsapp") || step.channels.includes("sms")
  const showsEmail = step.channels.includes("email")

  return (
    <div className="space-y-2.5">
      {unknown.length ? (
        <p
          className="flex items-start gap-1.5 rounded-lg border border-[rgb(248,228,214)] bg-[rgb(255,247,242)] px-3 py-2 text-xs font-medium text-[rgb(140,92,68)]"
          role="alert"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            {t("automations.preview.unknownPlaceholder")}{" "}
            <span className="font-mono">{unknown.map((p) => `{${p}}`).join(", ")}</span>
          </span>
        </p>
      ) : null}

      {showsWhatsApp ? (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <MessageCircle className="size-3.5" aria-hidden />
            {t("automations.preview.whatsapp")}
          </p>
          {/* Chat-bubble shape so the line breaks read the way they will on a phone. */}
          <div className="max-w-md rounded-2xl rounded-ss-sm bg-emerald-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-emerald-100">
            <p className="whitespace-pre-line break-words">{rendered.body}</p>
            {step.actions.length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-emerald-200/70 pt-2">
                {step.actions
                  .filter((a) => a !== "reply_free_text")
                  .map((action) => (
                    <span
                      key={action}
                      className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                    >
                      {t(`automations.action.${action}`)}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showsEmail ? (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <Mail className="size-3.5" aria-hidden />
            {t("automations.preview.email")}
          </p>
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              {rendered.subject || t("automations.preview.noSubject")}
            </p>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
              {rendered.body}
            </p>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-400">{t("automations.preview.sampleNote")}</p>
    </div>
  )
}
