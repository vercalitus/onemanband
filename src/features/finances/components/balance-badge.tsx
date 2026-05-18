"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

/** Per-patient balance pill in invoice rows — currency + badges follow locale. */
export function BalanceBadge({ balance }: { balance: number }) {
  const { formatMoney, t } = useLocale()
  if (balance > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5",
          "text-[11px] font-semibold text-rose-700",
        )}
      >
        <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
        <span className="font-mono tabular-nums">{formatMoney(balance)}</span>
        <span className="text-rose-500/80">{t("finances.badge.due")}</span>
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
        <span className="font-mono tabular-nums">{formatMoney(Math.abs(balance))}</span>
        <span className="text-emerald-600/80">{t("finances.badge.credit")}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      <span className="size-1.5 rounded-full bg-slate-400" aria-hidden />
      {t("finances.badge.settled")}
    </span>
  )
}
