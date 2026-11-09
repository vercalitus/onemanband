"use client"

import { useLocale } from "@/components/providers/locale-provider"

/**
 * The patient's whole balance, beside a single row. Quiet on purpose: the row's
 * own amount carries the orange outline when it is open, and a second orange
 * mark beside it would make every unpaid row shout twice.
 */
export function BalanceBadge({ balance }: { balance: number }) {
  const { formatMoney, t } = useLocale()
  if (balance > 0) {
    return (
      <span className="inline-flex items-baseline gap-1 text-sm font-medium text-ink">
        <span className="tabular-nums">{formatMoney(balance)}</span>
        <span className="font-normal text-mute">{t("finances.badge.due")}</span>
      </span>
    )
  }
  if (balance < 0) {
    return (
      <span className="inline-flex items-baseline gap-1 text-sm font-medium text-olive">
        <span className="tabular-nums">{formatMoney(Math.abs(balance))}</span>
        <span>{t("finances.badge.credit")}</span>
      </span>
    )
  }
  return <span className="text-sm text-mute">{t("finances.badge.settled")}</span>
}
