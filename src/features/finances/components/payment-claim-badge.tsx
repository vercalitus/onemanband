"use client"

import { useLocale } from "@/components/providers/locale-provider"

/**
 * "Says they paid" — the state between owing and settled.
 *
 * A dashed outline on purpose — the state vocabulary's "not confirmed": not
 * the orange of a debt, because chasing this person would be wrong, and not
 * the olive of a settled account, because the money is unverified and no
 * receipt exists yet. It is a question waiting on the practitioner, and it
 * should look like one.
 */
export function PaymentClaimBadge({ amount }: { amount?: string }) {
  const { t } = useLocale()
  return (
    <span className="inline-flex min-h-7 items-center rounded-[4px] border-[1.5px] border-dashed border-ink/60 px-2 text-sm font-medium whitespace-nowrap tabular-nums text-ink">
      {amount
        ? t("patients.claimBadge.amount", { amount })
        : t("patients.claimBadge")}
    </span>
  )
}
