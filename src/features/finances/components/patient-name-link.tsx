"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * From Financial OS rows, deep-link to the patient profile with Finances open
 * so billing context (treatment + money) is one tab away from Records.
 */
export function PatientNameLink({
  patientId,
  children,
  className,
}: {
  patientId: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={`/patients/${patientId}?tab=finances`}
      className={cn(
        "rounded-[4px] text-ink underline-offset-3 decoration-1 transition-colors hover:text-cobalt hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
        className,
      )}
    >
      {children}
    </Link>
  )
}
