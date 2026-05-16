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
        "text-slate-900 underline-offset-2 transition-colors hover:text-sky-700 hover:underline",
        className,
      )}
    >
      {children}
    </Link>
  )
}
