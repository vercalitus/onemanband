"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"

/**
 * "Says they paid" — the state between owing and settled.
 *
 * Amber on purpose: not the rose of a debt, because chasing this person would
 * be wrong, and not the calm of a settled account, because the money is
 * unverified and no receipt exists yet. It is a question waiting on the
 * practitioner, and it should look like one.
 */
export function PaymentClaimBadge({ amount }: { amount?: string }) {
  const { t } = useLocale()
  return (
    <Badge className="border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-amber-100">
      {amount
        ? t("patients.claimBadge.amount", { amount })
        : t("patients.claimBadge")}
    </Badge>
  )
}
