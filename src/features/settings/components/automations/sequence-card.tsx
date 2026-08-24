"use client"

import { AlertTriangle, Eye, Mail, MessageCircle, RotateCcw, Smartphone } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ScheduleEditor } from "@/features/settings/components/automations/schedule-editor"
import { StepPreview } from "@/features/settings/components/automations/step-preview"
import { defaultSequences } from "@/features/automations/lib/default-sequences"
import { TEMPLATE_PLACEHOLDERS } from "@/features/automations/lib/template-render"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
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

const ALL_CHANNELS: MessageChannel[] = ["whatsapp", "email", "sms"]

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
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-lg font-bold tracking-tight text-white">
              {t(`automations.seq.${sequence.id}.name`)}
            </CardTitle>
            <CardDescription className="text-sky-100/80">
              {t(`automations.seq.${sequence.id}.desc`)}
            </CardDescription>
          </div>
          <Switch
            checked={sequence.enabled}
            aria-label={`${t("automations.seq.toggleAria")}: ${t(`automations.seq.${sequence.id}.name`)}`}
            onCheckedChange={(enabled) => onChange({ ...sequence, enabled })}
          />
        </div>
      </CardHeader>

      <CardContent className={cn(elevatedCardBodyClass, "space-y-0 p-0")}>
        <ol className={cn("divide-y divide-slate-100", !sequence.enabled && "opacity-55")}>
          {sequence.steps.map((step, index) => (
            <li key={step.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-600/10 text-xs font-bold tabular-nums text-sky-700">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {t(`automations.step.${step.id}.name`)}
                      </p>
                      {step.sensitive ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]"
                        >
                          <AlertTriangle className="size-3" aria-hidden />
                          {t("automations.step.sensitive")}
                        </Badge>
                      ) : null}
                    </div>
                    <Switch
                      checked={step.enabled}
                      aria-label={`${t("automations.step.toggleAria")}: ${t(`automations.step.${step.id}.name`)}`}
                      onCheckedChange={(enabled) => patchStep(step.id, { enabled })}
                    />
                  </div>

                  <ScheduleEditor
                    schedule={step.schedule}
                    onChange={(schedule: ScheduleRule) => patchStep(step.id, { schedule })}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t("automations.step.channels")}
                    </span>
                    {ALL_CHANNELS.map((channel) => {
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
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                            on
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:border-sky-300",
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {t(`automations.channel.${channel}`)}
                        </button>
                      )
                    })}
                  </div>

                  {step.channels.includes("email") ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {t("automations.step.subject")}
                      </span>
                      <input
                        value={step.template.emailSubject ?? ""}
                        onChange={(e) =>
                          patchStep(step.id, {
                            template: { ...step.template, emailSubject: e.target.value },
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t("automations.step.message")}
                    </span>
                    <textarea
                      rows={3}
                      value={step.template.body}
                      onChange={(e) =>
                        patchStep(step.id, {
                          template: { ...step.template, body: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t("automations.step.buttons")}
                    </span>
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
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                            on
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:border-sky-300",
                          )}
                        >
                          {t(`automations.action.${action}`)}
                        </button>
                      )
                    })}
                  </div>

                  <details className="group/preview">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800">
                      <Eye className="size-3.5" aria-hidden />
                      {t("automations.preview.toggle")}
                    </summary>
                    <div className="mt-3">
                      <StepPreview step={step} />
                    </div>
                  </details>

                  {isStepModified(sequence.id, step) ? (
                    <button
                      type="button"
                      onClick={() => resetStep(step.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t("automations.step.reset")}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
          <p className="text-xs leading-relaxed text-slate-500">
            {t("automations.step.placeholders")}{" "}
            <span className="font-mono text-slate-600">
              {TEMPLATE_PLACEHOLDERS.map((p) => `{${p}}`).join("  ")}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
