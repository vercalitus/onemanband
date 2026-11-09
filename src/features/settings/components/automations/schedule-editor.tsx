"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { Input } from "@/components/ui/input"
import type { ScheduleRule } from "@/types/automation"

const CONTROL = "border-hair tabular-nums"

/**
 * Editor for one step's timing rule.
 *
 * The mode is fixed per step and not user-switchable — "18:00 the evening
 * before" and "one hour before" are structurally different rules, and letting
 * someone flip between them mid-edit produces nonsense like a recurring
 * dunning ladder anchored to an appointment that already happened. Only the
 * numbers inside a mode are editable.
 */
export function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: ScheduleRule
  onChange: (next: ScheduleRule) => void
}) {
  const { t } = useLocale()

  if (schedule.mode === "immediate") {
    return <p className="text-[17px] text-ink">{t("automations.schedule.immediate")}</p>
  }

  if (schedule.mode === "offset") {
    const before = schedule.minutes < 0
    const magnitude = Math.abs(schedule.minutes)
    return (
      <div className="flex flex-wrap items-center gap-2 text-[17px] text-ink">
        <Input
          type="number"
          min={0}
          step={5}
          value={magnitude}
          onChange={(e) => {
            const next = Math.max(0, Number(e.target.value) || 0)
            onChange({ ...schedule, minutes: before ? -next : next })
          }}
          className={`${CONTROL} w-24`}
          aria-label={t("automations.schedule.minutesAria")}
        />
        <span>{t("automations.schedule.minutes")}</span>
        <span className="font-medium">
          {t(
            before
              ? `automations.schedule.before.${schedule.anchor}`
              : `automations.schedule.after.${schedule.anchor}`,
          )}
        </span>
      </div>
    )
  }

  if (schedule.mode === "clock_before") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[17px] text-ink">
        <span>{t("automations.schedule.at")}</span>
        <Input
          type="time"
          step={300}
          value={schedule.atTime}
          onChange={(e) => onChange({ ...schedule, atTime: e.target.value || "18:00" })}
          className={`${CONTROL} w-36`}
          aria-label={t("automations.schedule.timeAria")}
        />
        <Input
          type="number"
          min={1}
          max={14}
          value={schedule.daysBefore}
          onChange={(e) =>
            onChange({ ...schedule, daysBefore: Math.max(1, Number(e.target.value) || 1) })
          }
          className={`${CONTROL} w-20`}
          aria-label={t("automations.schedule.daysAria")}
        />
        <span>{t("automations.schedule.daysBeforeAppointment")}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[17px] text-ink">
      <span>{t("automations.schedule.firstAfter")}</span>
      <Input
        type="number"
        min={1}
        value={schedule.firstAfterHours}
        onChange={(e) =>
          onChange({ ...schedule, firstAfterHours: Math.max(1, Number(e.target.value) || 1) })
        }
        className={`${CONTROL} w-20`}
        aria-label={t("automations.schedule.firstAfterAria")}
      />
      <span>{t("automations.schedule.hoursThenEvery")}</span>
      <Input
        type="number"
        min={1}
        value={schedule.everyHours}
        onChange={(e) =>
          onChange({ ...schedule, everyHours: Math.max(1, Number(e.target.value) || 1) })
        }
        className={`${CONTROL} w-20`}
        aria-label={t("automations.schedule.everyAria")}
      />
      <span>{t("automations.schedule.hoursUntilPaid")}</span>
      <span className="text-mute" aria-hidden>·</span>
      <span>{t("automations.schedule.maxRuns")}</span>
      <Input
        type="number"
        min={1}
        max={60}
        value={schedule.maxRuns}
        onChange={(e) =>
          onChange({ ...schedule, maxRuns: Math.max(1, Number(e.target.value) || 1) })
        }
        className={`${CONTROL} w-20`}
        aria-label={t("automations.schedule.maxRunsAria")}
      />
    </div>
  )
}
