"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Lightweight hover hint; also sets `title` for OS-level tooltip and a11y. */
export function HoverTip({
  children,
  tip,
  className,
}: {
  children: React.ReactNode
  tip: string
  className?: string
}) {
  return (
    <span className={cn("group relative inline-flex max-w-full min-w-0 align-middle", className)}>
      <span title={tip} className="min-w-0">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 w-max max-w-[min(240px,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1.5 text-center text-[10px] leading-snug whitespace-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {tip}
      </span>
    </span>
  )
}
