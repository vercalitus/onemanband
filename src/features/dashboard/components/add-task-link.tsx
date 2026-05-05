"use client"

import type { ReactNode } from "react"

import { useAddTask } from "@/components/providers/add-task-provider"

type Props = {
  className?: string
  children: ReactNode
  "aria-label"?: string
}

/** Opens add-task dialog via app-wide context (no URL/hash — reliable with App Router). */
export function AddTaskLink({ className, children, ...rest }: Props) {
  const { openAddTask } = useAddTask()

  return (
    <button type="button" className={className} onClick={openAddTask} {...rest}>
      {children}
    </button>
  )
}
