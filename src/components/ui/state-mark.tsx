import { cn } from "@/lib/utils"

/**
 * The one state vocabulary (DESIGN.md). A visit, a payment or a task is drawn
 * the same way on every screen:
 *
 *   done    filled olive
 *   plan    ring — booked, expected
 *   unsure  dashed ring — not confirmed
 *   cancel  struck ring
 *   now     orange
 *
 * Callers translate their own statuses into these five; the mark never
 * guesses from a domain type, so a new status has to be decided, not inherited.
 */
export type MarkState = "done" | "plan" | "unsure" | "cancel" | "now"

export function StateMark({
  state,
  className,
  label,
}: {
  state: MarkState
  className?: string
  /** Spoken name of the state. Omit only when the same word is printed beside it. */
  label?: string
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-block size-3 shrink-0 rounded-full",
        state === "done" && "bg-olive",
        state === "plan" && "border-2 border-ink",
        state === "unsure" && "border-2 border-dashed border-ink",
        state === "now" && "bg-signal",
        state === "cancel" &&
          "border-2 border-faint after:absolute after:start-[-3px] after:end-[-3px] after:top-1/2 after:h-0.5 after:-translate-y-1/2 after:-rotate-45 after:bg-faint",
        className,
      )}
    />
  )
}

export function StateLegend({
  items,
  className,
}: {
  items: { state: MarkState; label: string }[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mute", className)}>
      {items.map((it) => (
        <span key={it.state} className="inline-flex items-center gap-1.5">
          <StateMark state={it.state} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
