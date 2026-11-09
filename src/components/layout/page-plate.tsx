"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

/**
 * The plate — the cobalt band across the top of every screen (DESIGN.md).
 *
 * It belongs to the layout, but what it says belongs to the page: the patient
 * page puts the time, the session count and the balance there; the calendar
 * puts the week. A page does that by rendering <PagePlate>, which portals its
 * children into the band. With no <PagePlate> on screen the band shows the day.
 *
 * A portal rather than lifted state, so the facts are rendered by the page
 * that owns them, inside its own providers, and leave when it unmounts.
 */
type PlateCtx = {
  slot: HTMLElement | null
  setSlot: (el: HTMLElement | null) => void
  claimed: number
  claim: () => () => void
}

const PlateContext = createContext<PlateCtx | null>(null)

export function PlateProvider({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [claimed, setClaimed] = useState(0)
  const claim = useCallback(() => {
    setClaimed((n) => n + 1)
    return () => setClaimed((n) => n - 1)
  }, [])
  const value = useMemo(() => ({ slot, setSlot, claimed, claim }), [slot, claimed, claim])
  return <PlateContext.Provider value={value}>{children}</PlateContext.Provider>
}

/** Where page facts land. `fallback` (the day) shows while no page has claimed the plate. */
export function PlateSlot({ fallback }: { fallback: React.ReactNode }) {
  const ctx = useContext(PlateContext)
  return (
    <>
      {!ctx?.claimed && fallback}
      <div ref={ctx?.setSlot} className="contents" />
    </>
  )
}

export function PagePlate({ children }: { children: React.ReactNode }) {
  const ctx = useContext(PlateContext)
  const claim = ctx?.claim
  useEffect(() => claim?.(), [claim])
  if (!ctx?.slot) return null
  return createPortal(children, ctx.slot)
}

/* ---------- what goes on the plate ---------- */

export function PlateLabel({ children, now }: { children: React.ReactNode; now?: boolean }) {
  return (
    <span className="flex items-center gap-2 truncate text-sm leading-snug text-white/80">
      {now && <span className="size-2.5 shrink-0 rounded-full bg-signal" aria-hidden />}
      {children}
    </span>
  )
}

/**
 * One fact. `display` sets the value in Secular One at poster size — keep that
 * to the one or two facts the screen is for; the rest are 22px bold.
 */
export function PlateFact({
  label,
  children,
  display,
  now,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  display?: boolean
  now?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <PlateLabel now={now}>{label}</PlateLabel>
      <span
        className={cn(
          "tabular-nums text-white",
          display
            ? "mt-0.5 font-display text-[40px] leading-[0.95] sm:text-[56px]"
            : "mt-1 text-[22px] leading-tight font-bold",
        )}
      >
        {children}
      </span>
    </div>
  )
}

export function PlateDivider() {
  return <span className="hidden w-px self-stretch bg-white/25 sm:block" aria-hidden />
}

/** An amount owed: the one place orange outlines something on the plate. */
export function PlateDebt({ amount, label, sub }: { amount: React.ReactNode; label: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center rounded-md border-2 border-signal px-3.5 py-1.5">
      <span className="flex items-baseline gap-2 text-white">
        <span className="text-[22px] leading-tight font-bold tabular-nums">{amount}</span>
        <span className="text-[17px] font-medium">{label}</span>
      </span>
      {sub && <span className="text-sm text-white/80">{sub}</span>}
    </div>
  )
}

/** Pushes what follows to the far end of the plate. */
export function PlateSpacer() {
  return <span className="flex-1" aria-hidden />
}
