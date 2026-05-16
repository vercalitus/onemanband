import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/mock-finances"

/**
 * Compact per-patient balance pill used in invoice rows. Three states:
 *   debt    → patient owes us (warm rose, never aggressive red)
 *   credit  → patient overpaid / has credit on account (soft emerald)
 *   settled → no open balance (muted slate)
 */
export function BalanceBadge({ balance }: { balance: number }) {
  if (balance > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5",
          "text-[11px] font-semibold text-rose-700",
        )}
      >
        <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
        <span className="font-mono tabular-nums">{formatCurrency(balance)}</span>
        <span className="text-rose-500/80">due</span>
      </span>
    )
  }
  if (balance < 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5",
          "text-[11px] font-semibold text-emerald-700",
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        <span className="font-mono tabular-nums">{formatCurrency(Math.abs(balance))}</span>
        <span className="text-emerald-600/80">credit</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      <span className="size-1.5 rounded-full bg-slate-400" aria-hidden />
      Settled
    </span>
  )
}
