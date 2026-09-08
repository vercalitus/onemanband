"use client"

import { useEffect, useState } from "react"

import { fetchPatientsWithOpenInvoices } from "@/features/finances/lib/finance-repository"
import { patients as mockPatients } from "@/lib/mock-data"

/**
 * Which patients owe money, for the dot on an appointment card.
 *
 * It used to parse the balance out of the demo file's display strings ("₪120",
 * "Settled"). Real patients carry no balance string — it is derived from the
 * ledger — so the dot could only ever appear for invented people, and never for
 * anyone actually in debt.
 *
 * Asked once and shared: two views draw these cards and the question is the
 * same for both. The demo balances stand in when there is no ledger to ask, so
 * a deploy with no database still demonstrates the dot.
 */
let cached: Promise<Set<string>> | null = null

function demoDebtors(): Set<string> {
  return new Set(
    mockPatients
      .filter((p) => {
        const value = Number.parseFloat((p.balance ?? "").replace(/[^0-9.-]/g, ""))
        return Number.isFinite(value) && value > 0
      })
      .map((p) => p.id),
  )
}

function loadDebtors(): Promise<Set<string>> {
  if (!cached) {
    cached = fetchPatientsWithOpenInvoices().then((ids) => ids ?? demoDebtors())
  }
  return cached
}

/**
 * Empty until the answer arrives, so nothing is marked as owing before the
 * ledger has been read. An absent dot is a smaller mistake than a wrong one.
 */
export function useOutstandingBalances(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    void loadDebtors().then((set) => {
      if (!cancelled) setIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ids
}
