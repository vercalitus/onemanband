"use client"

import type { ReactNode } from "react"

import { StateMark, type MarkState } from "@/components/ui/state-mark"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * The settings form language (DESIGN.md, direction A).
 *
 * One paper sheet per tab, its sections separated by hairlines rather than
 * stacked as cards; a 14px muted label above each 44px field. Kept in one file
 * so every tab draws a field the same way — the tabs used to each carry their
 * own copy of a label class, and they had drifted apart.
 */

/** Native <select> and <textarea> styled to match `Input`. */
export const selectClass =
  "h-11 w-full rounded-md border border-hair bg-paper px-3 text-[17px] text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/20 disabled:opacity-50"

export const textareaClass =
  "w-full rounded-md border border-hair bg-paper px-3 py-2.5 text-[17px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/20"

/** Applied to `Input` where the shared primitive's border would otherwise differ. */
export const inputClass = "border-hair"

/** Times, minutes and money inside a field. */
export const numericInputClass = "border-hair tabular-nums"

export const labelClass = "text-sm font-medium leading-snug text-mute"
export const hintClass = "text-sm leading-snug text-mute"

/** The tab's working surface: paper, one hairline round it, hairlines between sections. */
export function SettingsSheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-hair rounded-md border border-hair bg-paper", className)}>
      {children}
    </div>
  )
}

/** A titled region of a sheet. `action` sits at the far end of the title row (a switch, a button). */
export function SettingsSection({
  title,
  description,
  action,
  children,
  dimmed,
  className,
  bodyClassName,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  /** The section's master switch is off: what is below still reads, but quieter. */
  dimmed?: boolean
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("px-4 py-5 sm:px-6 sm:py-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 className="text-[17px] leading-snug font-bold text-ink">{title}</h2>
          {description ? <p className={cn(hintClass, "mt-1")}>{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </div>
      {children ? (
        <div className={cn("mt-5", dimmed && "opacity-60", bodyClassName)}>{children}</div>
      ) : null}
    </section>
  )
}

/**
 * Label above a control. Rendered as a <label> wrapping the control so it is
 * named without ids; pass `as="div"` when the children hold more than one
 * control (a file picker beside a remove button, say).
 */
export function SettingsField({
  label,
  hint,
  children,
  className,
  as = "label",
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  as?: "label" | "div"
}) {
  const Tag = as
  return (
    <Tag className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className={hintClass}>{hint}</span> : null}
    </Tag>
  )
}

/**
 * A switch with its words beside it. The whole row is the target — the switch
 * itself is 24px tall, and a label round it is what makes it 44.
 */
export function SwitchRow({
  checked,
  onCheckedChange,
  ariaLabel,
  title,
  sub,
  disabled,
  className,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  ariaLabel?: string
  title: ReactNode
  sub?: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel} disabled={disabled} />
      <span className="min-w-0">
        <span className="block text-[17px] leading-snug font-medium text-ink">{title}</span>
        {sub ? <span className={cn(hintClass, "block")}>{sub}</span> : null}
      </span>
    </label>
  )
}

/** A bare switch given a 44px target, for a section's title row. */
export function SwitchTarget({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  ariaLabel: string
}) {
  return (
    <label className="flex size-11 cursor-pointer items-center justify-center">
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel} />
    </label>
  )
}

/** A state in words, drawn with the one state vocabulary. */
export function StateLine({ state, children, className }: { state: MarkState; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium text-ink", className)}>
      <StateMark state={state} />
      {children}
    </span>
  )
}

/** A note that something needs attention — ink on paper, outlined, never orange text. */
export function AttentionNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-md border border-signal bg-signal-tint px-3 py-2 text-sm leading-snug text-ink",
        className,
      )}
      role="alert"
    >
      {children}
    </p>
  )
}

/** Toggle chip: paper with a hairline, cobalt when pressed (the button's own `aria-pressed` style). */
export const chipClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-hair bg-paper px-3 text-sm font-medium text-ink transition-colors hover:bg-ground aria-pressed:border-cobalt aria-pressed:bg-cobalt aria-pressed:font-bold aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
