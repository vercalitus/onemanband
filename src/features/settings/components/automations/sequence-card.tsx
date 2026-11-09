"use client"

import { AlertTriangle, Eye, Mail, MessageCircle, RotateCcw, Smartphone } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { ScheduleEditor } from "@/features/settings/components/automations/schedule-editor"
import { StepPreview } from "@/features/settings/components/automations/step-preview"
import {
  SettingsField,
  SettingsSection,
  SettingsSheet,
  SwitchTarget,
  chipClass,
  labelClass,
  selectClass,
  textareaClass,
} from "@/features/settings/components/settings-ui"
import { VISIBLE_CHANNELS } from "@/features/automations/lib/channels"
import { defaultSequences } from "@/features/automations/lib/default-sequences"
import { TEMPLATE_PLACEHOLDERS } from "@/features/automations/lib/template-render"
import { cn } from "@/lib/utils"
import type {
  AutomationAction,
  AutomationSequence,
  AutomationStep,
  AutomationTrigger,
  MessageChannel,
  ScheduleRule,
} from "@/types/automation"

const CHANNEL_ICON: Record<MessageChannel, typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: Smartphone,
}

// SMS is deliberately absent from the picker — see channels.ts. A step that
// already carries it keeps working; it just cannot be added by hand.

/**
 * Buttons offered per trigger.
 *
 * Not one flat list: a booking confirmation has no invoice to open and a
 * payment reminder has nothing to reschedule. Offering every action everywhere
 * would let a clinic build a message whose buttons cannot work.
 */
const ACTIONS_FOR_TRIGGER: Record<AutomationTrigger, AutomationAction[]> = {
  "appointment.booked": ["confirm", "cancel", "reschedule", "reply_free_text"],
  "appointment.reminder": ["confirm", "cancel", "reschedule", "reply_free_text"],
  "treatment.completed": ["open_invoice", "reply_free_text"],
  "appointment.no_show": ["open_invoice", "reschedule", "reply_free_text"],
  "invoice.unpaid": ["open_invoice", "reply_free_text"],
  "progress.checkpoint": ["open_questionnaire", "reply_free_text"],
  // Nothing is booked yet, so there is nothing to confirm or cancel: the whole
  // message is an invitation to pick a time.
  "rebooking.needed": ["reschedule", "reply_free_text"],
}

const DEFAULTS = defaultSequences()

/** True when the practitioner has edited this step away from the shipped default. */
function isStepModified(sequenceId: string, step: AutomationStep): boolean {
  const original = DEFAULTS.find((s) => s.id === sequenceId)?.steps.find((x) => x.id === step.id)
  if (!original) return false
  return JSON.stringify({ ...original, enabled: step.enabled }) !== JSON.stringify(step)
}

/**
 * One automation sequence, rendered as a vertical timeline of its steps.
 *
 * The timeline shape is the point: these steps fire in order over hours or
 * days, and a flat list of form rows hides that. Reading top to bottom should
 * tell you what a patient actually receives and when.
 */
export function SequenceCard({
  sequence,
  onChange,
}: {
  sequence: AutomationSequence
  onChange: (next: AutomationSequence) => void
}) {
  const { t } = useLocale()

  const patchStep = (stepId: string, patch: Partial<AutomationStep>) =>
    onChange({
      ...sequence,
      steps: sequence.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    })

  /** Restore shipped copy and timing, keeping the on/off state as it is. */
  const resetStep = (stepId: string) => {
    const original = DEFAULTS.find((s) => s.id === sequence.id)?.steps.find((x) => x.id === stepId)
    if (!original) return
    onChange({
      ...sequence,
      steps: sequence.steps.map((s) => (s.id === stepId ? { ...original, enabled: s.enabled } : s)),
    })
  }

  return (
    <SettingsSheet>
      <SettingsSection
        title={t(`automations.seq.${sequence.id}.name`)}
        description={t(`automations.seq.${sequence.id}.desc`)}
        action={
          <SwitchTarget
            checked={sequence.enabled}
            ariaLabel={`${t("automations.seq.toggleAria")}: ${t(`automations.seq.${sequence.id}.name`)}`}
            onCheckedChange={(enabled) => onChange({ ...sequence, enabled })}
          />
        }
      />

      <ol className={cn("divide-y divide-hair-soft", !sequence.enabled && "opacity-60")}>
        {sequence.steps.map((step, index) => (
          <li key={step.id} className="px-4 py-5 sm:px-6">
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums",
                  step.enabled ? "border-ink text-ink" : "border-faint text-mute",
                )}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[17px] font-bold text-ink">
                      {t(`automations.step.${step.id}.name`)}
                    </p>
                    {step.sensitive ? (
                      <span className="inline-flex min-h-6 items-center gap-1 rounded-md border border-hair px-2 text-sm font-medium text-ink">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        {t("automations.step.sensitive")}
                      </span>
                    ) : null}
                  </div>
                  <SwitchTarget
                    checked={step.enabled}
                    ariaLabel={`${t("automations.step.toggleAria")}: ${t(`automations.step.${step.id}.name`)}`}
                    onCheckedChange={(enabled) => patchStep(step.id, { enabled })}
                  />
                </div>

                <ScheduleEditor
                  schedule={step.schedule}
                  onChange={(schedule: ScheduleRule) => patchStep(step.id, { schedule })}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(labelClass, "me-1")}>{t("automations.step.channels")}</span>
                  {VISIBLE_CHANNELS.map((channel) => {
                    const Icon = CHANNEL_ICON[channel]
                    const on = step.channels.includes(channel)
                    return (
                      <button
                        key={channel}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          patchStep(step.id, {
                            channels: on
                              ? step.channels.filter((c) => c !== channel)
                              : [...step.channels, channel],
                          })
                        }
                        className={chipClass}
                      >
                        <Icon className="size-4" aria-hidden />
                        {t(`automations.channel.${channel}`)}
                      </button>
                    )
                  })}
                </div>

                {step.channels.includes("email") ? (
                  <SettingsField label={t("automations.step.subject")}>
                    <input
                      value={step.template.emailSubject ?? ""}
                      onChange={(e) =>
                        patchStep(step.id, {
                          template: { ...step.template, emailSubject: e.target.value },
                        })
                      }
                      className={selectClass}
                    />
                  </SettingsField>
                ) : null}

                <SettingsField label={t("automations.step.message")}>
                  <textarea
                    rows={3}
                    value={step.template.body}
                    onChange={(e) =>
                      patchStep(step.id, {
                        template: { ...step.template, body: e.target.value },
                      })
                    }
                    className={textareaClass}
                  />
                </SettingsField>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(labelClass, "me-1")}>{t("automations.step.buttons")}</span>
                  {ACTIONS_FOR_TRIGGER[sequence.trigger].map((action) => {
                    const on = step.actions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          patchStep(step.id, {
                            actions: on
                              ? step.actions.filter((a) => a !== action)
                              : [...step.actions, action],
                          })
                        }
                        className={chipClass}
                      >
                        {t(`automations.action.${action}`)}
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-start gap-x-6">
                  <details className="group/preview min-w-0 flex-1">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-cobalt underline-offset-3 hover:underline">
                      <Eye className="size-4" aria-hidden />
                      {t("automations.preview.toggle")}
                    </summary>
                    <div className="mt-2">
                      <StepPreview step={step} />
                    </div>
                  </details>

                  {isStepModified(sequence.id, step) ? (
                    <button
                      type="button"
                      onClick={() => resetStep(step.id)}
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-mute hover:text-ink"
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      {t("automations.step.reset")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="px-4 py-3 sm:px-6">
        <p className="text-sm leading-relaxed text-mute">
          {t("automations.step.placeholders")}{" "}
          <span className="font-mono text-ink" dir="ltr">
            {TEMPLATE_PLACEHOLDERS.map((p) => `{${p}}`).join("  ")}
          </span>
        </p>
      </div>
    </SettingsSheet>
  )
}
