"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bell,
  BellOff,
  CalendarRange,
  Check,
  Clock,
  Copy,
  Link2,
  Mail,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { MessageQueueCard } from "@/features/settings/components/automations/message-queue-card"
import { SequenceCard } from "@/features/settings/components/automations/sequence-card"
import { randomId } from "@/features/automations/lib/automation-store"
import { VISIBLE_CHANNELS } from "@/features/automations/lib/channels"
import { mintToken, tokenLink } from "@/features/automations/lib/tokens"
import {
  PATIENT_EXTRAS_EVENT,
  readOptOut,
  writeOptOut,
  type NotificationOptOut,
} from "@/features/patients/lib/patient-extras-store"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { patients } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { AutomationSequence, AvailabilityWindow, MessageChannel } from "@/types/automation"
import type { ClinicSettings } from "@/types/clinic-settings"

const CONTROL =
  "h-9 rounded-lg border-slate-200 bg-white text-sm text-slate-800 shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400"

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
    <div className="space-y-5">
      <ChannelsCard settings={settings} onChange={onChange} />
      <SelfBookingCard settings={settings} onChange={onChange} />
      <AvailabilityCard settings={settings} onChange={onChange} />

      <Card className={elevatedCardClass}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex items-center gap-2.5">
            <Clock className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">
                {t("automations.timing.title")}
              </CardTitle>
              <CardDescription className="text-sky-100/80">
                {t("automations.timing.desc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(elevatedCardBodyClass, "grid gap-5 sm:grid-cols-3")}>
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t("automations.timing.timezone")}
            </p>
            <p className="mt-1.5 font-mono text-sm text-slate-800">{a.timezone}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t("automations.timing.timezoneHint")}
            </p>
          </div>

          <div className="sm:col-span-3">
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <Switch
                checked={a.quietHours.enabled}
                aria-label={t("automations.quiet.toggleAria")}
                onCheckedChange={(enabled) =>
                  patch({ quietHours: { ...a.quietHours, enabled } })
                }
              />
              <span className="text-sm font-semibold text-slate-900">
                {t("automations.quiet.title")}
              </span>
              <Input
                type="time"
                step={300}
                value={a.quietHours.start}
                onChange={(e) =>
                  patch({ quietHours: { ...a.quietHours, start: e.target.value || "21:00" } })
                }
                className={cn(CONTROL, "w-32 font-mono tabular-nums")}
                aria-label={t("automations.quiet.startAria")}
              />
              <span className="text-slate-400">–</span>
              <Input
                type="time"
                step={300}
                value={a.quietHours.end}
                onChange={(e) =>
                  patch({ quietHours: { ...a.quietHours, end: e.target.value || "08:00" } })
                }
                className={cn(CONTROL, "w-32 font-mono tabular-nums")}
                aria-label={t("automations.quiet.endAria")}
              />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {t("automations.quiet.hint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <OptOutCard />

      <div className="flex items-center gap-2.5 pt-1">
        <Workflow className="size-5 text-sky-600" aria-hidden />
        <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900">
          {t("automations.sequences.title")}
        </h2>
      </div>
      <p className="-mt-3 text-sm leading-relaxed text-slate-600">
        {t("automations.sequences.desc")}
      </p>

      {a.sequences.map((sequence) => (
        <SequenceCard key={sequence.id} sequence={sequence} onChange={patchSequence} />
      ))}

      <MessageQueueCard />
      <AdminInsightsCard settings={settings} onChange={onChange} />
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
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex items-center gap-2.5">
          <Bell className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-white">
              {t("settings.notifications.remindersTitle")}
            </CardTitle>
            <CardDescription className="text-sky-100/80">
              {t("settings.notifications.remindersDesc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(elevatedCardBodyClass, "flex flex-col gap-4 sm:flex-row sm:items-center")}>
        {rows.map(({ channel, on, set }) => (
          <div key={channel} className="flex items-center gap-3 sm:first:ps-0 sm:ps-6">
            <Switch
              checked={on}
              aria-label={t(`settings.notifications.${channel}Aria`)}
              onCheckedChange={set}
            />
            <span className="text-sm font-semibold text-slate-900">
              {t(`settings.notifications.${channel}Label`)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
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
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex items-center gap-2.5">
          <Mail className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-white">
              {t("settings.notifications.insightsTitle")}
            </CardTitle>
            <CardDescription className="text-sky-100/80">
              {t("settings.notifications.insightsDesc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={elevatedCardBodyClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={n.dailyDigest}
              aria-label={t("settings.notifications.digestAria")}
              onCheckedChange={(dailyDigest) => patch({ dailyDigest })}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t("settings.notifications.digestTitle")}
              </p>
              <p className="text-xs text-slate-500">{t("settings.notifications.digestSub")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:border-s sm:border-slate-200 sm:ps-8">
            <Switch
              checked={n.weeklyReport}
              aria-label={t("settings.notifications.weeklyAria")}
              onCheckedChange={(weeklyReport) => patch({ weeklyReport })}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t("settings.notifications.weeklyTitle")}
              </p>
              <p className="text-xs text-slate-500">{t("settings.notifications.weeklySub")}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
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
        className={cn(CONTROL, "mt-1.5 w-full font-mono tabular-nums")}
      />
      {hint ? <span className="mt-1 block text-xs leading-relaxed text-slate-500">{hint}</span> : null}
    </label>
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
  const [rows, setRows] = useState<{ id: string; name: string; optOut: NotificationOptOut }[]>([])

  const refresh = useCallback(() => {
    setRows(patients.map((p) => ({ id: p.id, name: p.fullName, optOut: readOptOut(p.id) })))
  }, [])

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
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex items-center gap-2.5">
          <BellOff className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-white">
              {t("automations.optOut.title")}
            </CardTitle>
            <CardDescription className="text-sky-100/80">
              {t("automations.optOut.desc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(elevatedCardBodyClass, "p-0")}>
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
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
                        "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                        blocked
                          ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700",
                        row.optOut.all && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {t(`automations.channel.${channel}`)}
                    </button>
                  )
                })}
              </div>

              <label className="flex items-center gap-2">
                <Switch
                  checked={row.optOut.all}
                  aria-label={`${t("automations.optOut.allAria")}: ${row.name}`}
                  onCheckedChange={(all) => update(row.id, { all })}
                />
                <span className="text-xs font-semibold text-slate-600">
                  {t("automations.optOut.all")}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Link2 className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">
                {t("automations.selfBooking.title")}
              </CardTitle>
              <CardDescription className="text-sky-100/80">
                {t("automations.selfBooking.desc")}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={sb.enabled}
            aria-label={t("automations.selfBooking.toggleAria")}
            onCheckedChange={(enabled) => patch({ enabled })}
          />
        </div>
      </CardHeader>
      <CardContent className={cn(elevatedCardBodyClass, "space-y-5", !sb.enabled && "opacity-55")}>
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

        <div className="flex items-center gap-3">
          <Switch
            checked={sb.requireDocuments}
            aria-label={t("automations.selfBooking.requireDocsAria")}
            onCheckedChange={(requireDocuments) => patch({ requireDocuments })}
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t("automations.selfBooking.requireDocs")}
            </p>
            <p className="text-xs text-slate-500">{t("automations.selfBooking.requireDocsHint")}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t("automations.selfBooking.allowedTypes")}
          </p>
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
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                    on
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300",
                  )}
                >
                  {row.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {t("automations.selfBooking.linkTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {t("automations.selfBooking.linkHint")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={generate} className="gap-1.5">
              <Plus className="size-3.5" aria-hidden />
              {t("automations.selfBooking.generate")}
            </Button>
            {link ? (
              <>
                <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                  {link}
                </code>
                <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 border-slate-200">
                  {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                  {t(copied ? "automations.selfBooking.copied" : "automations.selfBooking.copy")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
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
    <Card className={elevatedCardClass}>
      <CardHeader className={darkCardHeaderClass}>
        <div className="flex items-center gap-2.5">
          <CalendarRange className="size-5 stroke-[1.6] text-sky-400" aria-hidden />
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-white">
              {t("automations.availability.title")}
            </CardTitle>
            <CardDescription className="text-sky-100/80">
              {t("automations.availability.desc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(elevatedCardBodyClass, "space-y-3")}>
        {windows.length === 0 ? (
          <p className="text-sm leading-relaxed text-slate-500">
            {t("automations.availability.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {windows.map((window) => (
              <li
                key={window.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
              >
                <select
                  value={window.weekdayIndex}
                  onChange={(e) => update(window.id, { weekdayIndex: Number(e.target.value) })}
                  className={cn(CONTROL, "w-36 appearance-none px-3")}
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
                  className={cn(CONTROL, "w-32 font-mono tabular-nums")}
                  aria-label={t("automations.availability.startAria")}
                />
                <span className="text-slate-400">–</span>
                <Input
                  type="time"
                  step={300}
                  value={window.endTime}
                  onChange={(e) => update(window.id, { endTime: e.target.value })}
                  className={cn(CONTROL, "w-32 font-mono tabular-nums")}
                  aria-label={t("automations.availability.endAria")}
                />
                {window.endTime <= window.startTime ? (
                  <Badge
                    variant="outline"
                    className="border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]"
                  >
                    {t("automations.availability.invalid")}
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWindows(windows.filter((w) => w.id !== window.id))}
                  className="ms-auto text-slate-500 hover:text-[rgb(171,119,93)]"
                  aria-label={t("automations.availability.remove")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="outline" onClick={add} className="gap-1.5 border-slate-200">
          <Plus className="size-3.5" aria-hidden />
          {t("automations.availability.add")}
        </Button>
      </CardContent>
    </Card>
  )
}
