"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Plus, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StateMark } from "@/components/ui/state-mark"
import { Switch } from "@/components/ui/switch"
import { MessageQueueCard } from "@/features/settings/components/automations/message-queue-card"
import { SequenceCard } from "@/features/settings/components/automations/sequence-card"
import {
  SettingsField,
  SettingsSection,
  SettingsSheet,
  SwitchRow,
  SwitchTarget,
  chipClass,
  hintClass,
  labelClass,
  numericInputClass,
  selectClass,
} from "@/features/settings/components/settings-ui"
import { randomId } from "@/features/automations/lib/automation-store"
import { VISIBLE_CHANNELS } from "@/features/automations/lib/channels"
import { mintToken, tokenLink } from "@/features/automations/lib/tokens"
import {
  PATIENT_EXTRAS_EVENT,
  readOptOut,
  writeOptOut,
  type NotificationOptOut,
} from "@/features/patients/lib/patient-extras-store"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import { cn } from "@/lib/utils"
import type { AutomationSequence, AvailabilityWindow, MessageChannel } from "@/types/automation"
import type { ClinicSettings } from "@/types/clinic-settings"

/**
 * The single place notifications are managed.
 *
 * Previously split in two — a "Notifications" tab with channel switches and a
 * separate "Automations" tab with the actual sequences. Anyone looking for
 * message settings went to the first and found a stub, so the two are merged:
 * channels, sequences, content, timing, patient preferences and the queue all
 * live here, top to bottom in the order you'd reason about them.
 */
export function NotificationsTab({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const a = settings.automations

  const patch = (partial: Partial<typeof a>) =>
    onChange({ ...settings, automations: { ...a, ...partial } })

  const patchSequence = (next: AutomationSequence) =>
    patch({ sequences: a.sequences.map((s) => (s.id === next.id ? next : s)) })

  return (
    <div className="space-y-8">
      <SettingsSheet>
        <ChannelsCard settings={settings} onChange={onChange} />
        <SelfBookingCard settings={settings} onChange={onChange} />
        <AvailabilityCard settings={settings} onChange={onChange} />

        <SettingsSection title={t("automations.timing.title")} description={t("automations.timing.desc")}>
          <div className="grid gap-5 sm:grid-cols-3">
            <NumberField
              label={t("automations.timing.noShowGrace")}
              hint={t("automations.timing.noShowGraceHint")}
              value={a.noShowGraceMinutes}
              min={0}
              max={240}
              step={5}
              onChange={(noShowGraceMinutes) => patch({ noShowGraceMinutes })}
            />
            <NumberField
              label={t("automations.timing.questionnaireEvery")}
              hint={t("automations.timing.questionnaireEveryHint")}
              value={a.progressQuestionnaireEverySessions}
              min={0}
              max={50}
              onChange={(progressQuestionnaireEverySessions) =>
                patch({ progressQuestionnaireEverySessions })
              }
            />
            <div className="grid content-start gap-1.5">
              <span className={labelClass}>{t("automations.timing.timezone")}</span>
              <p className="flex h-11 items-center font-mono text-[17px] text-ink" dir="ltr">
                {a.timezone}
              </p>
              <span className={hintClass}>{t("automations.timing.timezoneHint")}</span>
            </div>
          </div>

          <div className="mt-5 border-t border-hair-soft pt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <SwitchRow
                checked={a.quietHours.enabled}
                ariaLabel={t("automations.quiet.toggleAria")}
                onCheckedChange={(enabled) => patch({ quietHours: { ...a.quietHours, enabled } })}
                title={t("automations.quiet.title")}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  step={300}
                  value={a.quietHours.start}
                  onChange={(e) =>
                    patch({ quietHours: { ...a.quietHours, start: e.target.value || "21:00" } })
                  }
                  className={cn(numericInputClass, "w-36")}
                  aria-label={t("automations.quiet.startAria")}
                />
                <span className="text-mute" aria-hidden>
                  –
                </span>
                <Input
                  type="time"
                  step={300}
                  value={a.quietHours.end}
                  onChange={(e) =>
                    patch({ quietHours: { ...a.quietHours, end: e.target.value || "08:00" } })
                  }
                  className={cn(numericInputClass, "w-36")}
                  aria-label={t("automations.quiet.endAria")}
                />
              </div>
            </div>
            <p className={cn(hintClass, "mt-1.5 max-w-2xl")}>{t("automations.quiet.hint")}</p>
          </div>
        </SettingsSection>

        <OptOutCard />
      </SettingsSheet>

      <section className="space-y-4">
        <div className="max-w-2xl">
          <h2 className="text-[22px] leading-tight font-bold text-ink">{t("automations.sequences.title")}</h2>
          <p className={cn(hintClass, "mt-1")}>{t("automations.sequences.desc")}</p>
        </div>

        {a.sequences.map((sequence) => (
          <SequenceCard key={sequence.id} sequence={sequence} onChange={patchSequence} />
        ))}
      </section>

      <MessageQueueCard />

      <SettingsSheet>
        <AdminInsightsCard settings={settings} onChange={onChange} />
      </SettingsSheet>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Master channel switches.
 *
 * Sits first because it overrides everything below it: a channel off here is
 * off for every sequence, whatever the individual steps say.
 */
function ChannelsCard({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const n = settings.notifications

  const patch = (partial: Partial<typeof n>) =>
    onChange({ ...settings, notifications: { ...n, ...partial } })

  const toggles: Record<MessageChannel, { on: boolean; set: (v: boolean) => void }> = {
    whatsapp: { on: n.whatsappEnabled, set: (v) => patch({ whatsappEnabled: v }) },
    email: { on: n.emailEnabled, set: (v) => patch({ emailEnabled: v }) },
    sms: { on: n.smsEnabled, set: (v) => patch({ smsEnabled: v }) },
  }
  const rows = VISIBLE_CHANNELS.map((channel) => ({ channel, ...toggles[channel] }))

  return (
    <SettingsSection
      title={t("settings.notifications.remindersTitle")}
      description={t("settings.notifications.remindersDesc")}
    >
      <div className="flex flex-col gap-x-8 gap-y-1 sm:flex-row sm:flex-wrap sm:items-center">
        {rows.map(({ channel, on, set }) => (
          <SwitchRow
            key={channel}
            checked={on}
            ariaLabel={t(`settings.notifications.${channel}Aria`)}
            onCheckedChange={set}
            title={t(`settings.notifications.${channel}Label`)}
          />
        ))}
      </div>
    </SettingsSection>
  )
}

/* -------------------------------------------------------------------------- */

/** Digests addressed to the practitioner, not the patient — hence last. */
function AdminInsightsCard({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const n = settings.notifications

  const patch = (partial: Partial<typeof n>) =>
    onChange({ ...settings, notifications: { ...n, ...partial } })

  return (
    <SettingsSection
      title={t("settings.notifications.insightsTitle")}
      description={t("settings.notifications.insightsDesc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SwitchRow
          checked={n.dailyDigest}
          ariaLabel={t("settings.notifications.digestAria")}
          onCheckedChange={(dailyDigest) => patch({ dailyDigest })}
          title={t("settings.notifications.digestTitle")}
          sub={t("settings.notifications.digestSub")}
        />
        <SwitchRow
          checked={n.weeklyReport}
          ariaLabel={t("settings.notifications.weeklyAria")}
          onCheckedChange={(weeklyReport) => patch({ weeklyReport })}
          title={t("settings.notifications.weeklyTitle")}
          sub={t("settings.notifications.weeklySub")}
        />
      </div>
    </SettingsSection>
  )
}

/* -------------------------------------------------------------------------- */

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
}) {
  return (
    <SettingsField label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)))
        }}
        className={cn(numericInputClass, "w-full")}
      />
    </SettingsField>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Per-patient notification opt-out.
 *
 * A patient asking not to be messaged must be honoured across every sequence
 * at once — editing each template would be both laborious and easy to get
 * wrong. The planner checks this before any channel is used, so switching a
 * patient off here silences reminders, invoices and questionnaires alike.
 */
function OptOutCard() {
  const { t } = useLocale()
  // The clinic's own patients. This read the demo file, so a practitioner could
  // not record "stop messaging me" against anybody real — the one person whose
  // wishes this card exists to honour was the one person not in the list.
  const patients = useMergedPatients()
  const [rows, setRows] = useState<{ id: string; name: string; optOut: NotificationOptOut }[]>([])

  const refresh = useCallback(() => {
    setRows(patients.map((p) => ({ id: p.id, name: p.fullName, optOut: readOptOut(p.id) })))
  }, [patients])

  // After mount only — the store is localStorage and would not match SSR.
  useEffect(() => {
    refresh()
    window.addEventListener(PATIENT_EXTRAS_EVENT, refresh)
    return () => window.removeEventListener(PATIENT_EXTRAS_EVENT, refresh)
  }, [refresh])

  const update = (patientId: string, partial: Partial<NotificationOptOut>) => {
    const next = { ...readOptOut(patientId), ...partial }
    writeOptOut(patientId, next)
    refresh()
  }

  return (
    <SettingsSection
      title={t("automations.optOut.title")}
      description={t("automations.optOut.desc")}
      bodyClassName="-mx-4 sm:-mx-6"
    >
      {/* Every patient in the clinic is a row here, so the list keeps to its
          own scroll rather than pushing the rest of the tab a screen away. */}
      <ul className="max-h-[30rem] divide-y divide-hair-soft overflow-y-auto border-y border-hair-soft">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
            <span className="min-w-0 flex-1 basis-40 truncate text-[17px] font-medium text-ink">
              {row.name}
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {VISIBLE_CHANNELS.map((channel) => {
                // A blanket opt-out subsumes the per-channel flags, so show
                // them as off and disabled rather than silently overridden.
                const blocked = row.optOut.all || row.optOut[channel]
                return (
                  <button
                    key={channel}
                    type="button"
                    aria-pressed={!blocked}
                    disabled={row.optOut.all}
                    onClick={() => update(row.id, { [channel]: !row.optOut[channel] })}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-md border border-hair bg-paper px-3 text-sm font-medium transition-colors hover:bg-ground disabled:cursor-not-allowed disabled:opacity-60",
                      blocked ? "text-mute line-through" : "text-ink",
                    )}
                  >
                    <StateMark state={blocked ? "cancel" : "done"} />
                    {t(`automations.channel.${channel}`)}
                  </button>
                )
              })}
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <Switch
                checked={row.optOut.all}
                aria-label={`${t("automations.optOut.allAria")}: ${row.name}`}
                onCheckedChange={(all) => update(row.id, { all })}
              />
              <span className="text-sm font-medium text-mute">{t("automations.optOut.all")}</span>
            </label>
          </li>
        ))}
      </ul>
    </SettingsSection>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Self-service booking, plus the invite link generator.
 *
 * The link is minted on demand rather than being a fixed clinic URL: each one
 * is a capability token tied to a single registration, so a link forwarded to
 * a third party cannot be reused indefinitely.
 */
function SelfBookingCard({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const sb = settings.automations.selfBooking
  const [link, setLink] = useState("")
  const [copied, setCopied] = useState(false)

  const patch = (partial: Partial<typeof sb>) =>
    onChange({
      ...settings,
      automations: { ...settings.automations, selfBooking: { ...sb, ...partial } },
    })

  const generate = () => {
    const token = mintToken("book", {})
    setLink(tokenLink(token))
    setCopied(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <SettingsSection
      title={t("automations.selfBooking.title")}
      description={t("automations.selfBooking.desc")}
      action={
        <SwitchTarget
          checked={sb.enabled}
          ariaLabel={t("automations.selfBooking.toggleAria")}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
      }
      dimmed={!sb.enabled}
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            label={t("automations.selfBooking.leadTime")}
            hint={t("automations.selfBooking.leadTimeHint")}
            value={sb.leadTimeHours}
            min={0}
            max={168}
            onChange={(leadTimeHours) => patch({ leadTimeHours })}
          />
          <NumberField
            label={t("automations.selfBooking.horizon")}
            hint={t("automations.selfBooking.horizonHint")}
            value={sb.horizonDays}
            min={1}
            max={180}
            onChange={(horizonDays) => patch({ horizonDays })}
          />
        </div>

        <SwitchRow
          checked={sb.requireDocuments}
          ariaLabel={t("automations.selfBooking.requireDocsAria")}
          onCheckedChange={(requireDocuments) => patch({ requireDocuments })}
          title={t("automations.selfBooking.requireDocs")}
          sub={t("automations.selfBooking.requireDocsHint")}
        />

        <div>
          <p className={cn(labelClass, "mb-2")}>{t("automations.selfBooking.allowedTypes")}</p>
          <div className="flex flex-wrap gap-2">
            {settings.treatmentTypes.map((row) => {
              const on = sb.allowedTypes.includes(row.type)
              return (
                <button
                  key={row.type}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    patch({
                      allowedTypes: on
                        ? sb.allowedTypes.filter((x) => x !== row.type)
                        : [...sb.allowedTypes, row.type],
                    })
                  }
                  className={chipClass}
                >
                  {row.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-hair-soft pt-5">
          <p className="text-[17px] leading-snug font-medium text-ink">{t("automations.selfBooking.linkTitle")}</p>
          <p className={cn(hintClass, "mt-1 max-w-2xl")}>{t("automations.selfBooking.linkHint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={generate} className="gap-2 text-sm">
              <Plus className="size-4" aria-hidden />
              {t("automations.selfBooking.generate")}
            </Button>
            {link ? (
              <>
                <code
                  className="flex h-11 min-w-0 flex-1 basis-64 items-center truncate rounded-md border border-hair bg-ground px-3 font-mono text-sm text-ink"
                  dir="ltr"
                >
                  {link}
                </code>
                <Button variant="outline" onClick={copy} className="gap-2 text-sm">
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {t(copied ? "automations.selfBooking.copied" : "automations.selfBooking.copy")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}

/* -------------------------------------------------------------------------- */

const WEEKDAY_KEYS = [
  "weekday.mon",
  "weekday.tue",
  "weekday.wed",
  "weekday.thu",
  "weekday.fri",
  "weekday.sat",
  "weekday.sun",
]

/**
 * "Available for the future" windows.
 *
 * Narrower than opening hours on purpose — see availability.ts. The card says
 * so explicitly because the distinction is the single most confusable thing in
 * this tab.
 */
function AvailabilityCard({
  settings,
  onChange,
}: {
  settings: ClinicSettings
  onChange: (next: ClinicSettings) => void
}) {
  const { t } = useLocale()
  const windows = settings.automations.futureAvailability

  const setWindows = (next: AvailabilityWindow[]) =>
    onChange({
      ...settings,
      automations: { ...settings.automations, futureAvailability: next },
    })

  const update = (id: string, partial: Partial<AvailabilityWindow>) =>
    setWindows(windows.map((w) => (w.id === id ? { ...w, ...partial } : w)))

  const add = () =>
    setWindows([
      ...windows,
      { id: randomId("av"), weekdayIndex: 0, startTime: "09:00", endTime: "12:00" },
    ])

  return (
    <SettingsSection
      title={t("automations.availability.title")}
      description={t("automations.availability.desc")}
    >
      {windows.length === 0 ? (
        <p className={hintClass}>{t("automations.availability.empty")}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-hair-soft border-y border-hair-soft sm:-mx-6">
          {windows.map((window) => (
            <li key={window.id} className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
              <select
                value={window.weekdayIndex}
                onChange={(e) => update(window.id, { weekdayIndex: Number(e.target.value) })}
                className={cn(selectClass, "w-40")}
                aria-label={t("automations.availability.weekdayAria")}
              >
                {WEEKDAY_KEYS.map((key, index) => (
                  <option key={key} value={index}>
                    {t(key)}
                  </option>
                ))}
              </select>
              <Input
                type="time"
                step={300}
                value={window.startTime}
                onChange={(e) => update(window.id, { startTime: e.target.value })}
                className={cn(numericInputClass, "w-36")}
                aria-label={t("automations.availability.startAria")}
              />
              <span className="text-mute" aria-hidden>
                –
              </span>
              <Input
                type="time"
                step={300}
                value={window.endTime}
                onChange={(e) => update(window.id, { endTime: e.target.value })}
                className={cn(numericInputClass, "w-36")}
                aria-label={t("automations.availability.endAria")}
              />
              {window.endTime <= window.startTime ? (
                <span className="inline-flex min-h-7 items-center rounded-md border border-signal px-2 text-sm font-medium text-ink">
                  {t("automations.availability.invalid")}
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWindows(windows.filter((w) => w.id !== window.id))}
                className="ms-auto text-mute hover:text-ink"
                aria-label={t("automations.availability.remove")}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" onClick={add} className="mt-4 gap-2 text-sm">
        <Plus className="size-4" aria-hidden />
        {t("automations.availability.add")}
      </Button>
    </SettingsSection>
  )
}
