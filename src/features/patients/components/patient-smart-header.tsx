"use client"

import Link from "next/link"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { useRef, useState } from "react"

import { cn } from "@/lib/utils"
import type { PatientSummary } from "@/types/domain"

const STATUS_BADGE: Record<PatientSummary["status"], string> = {
  active: "bg-slate-100 text-slate-700 border-slate-200",
  frozen: "bg-slate-100 text-slate-600 border-slate-200",
  past: "bg-slate-100 text-slate-500 border-slate-200",
}

interface Props {
  patient: PatientSummary
  totalSessionsDone: number
  planTarget: number
  clinicalStatus: string
  onClinicalStatusChange: (v: string) => void
}

export function PatientSmartHeader({
  patient,
  totalSessionsDone,
  planTarget,
  clinicalStatus,
  onClinicalStatusChange,
}: Props) {
  const clampedDone = Math.min(totalSessionsDone, planTarget)
  const pct = planTarget > 0 ? Math.round((clampedDone / planTarget) * 100) : 0

  const [editingStatus, setEditingStatus] = useState(false)
  const [draft, setDraft] = useState(clinicalStatus)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitStatus = () => {
    onClinicalStatusChange(draft.trim() || clinicalStatus)
    setEditingStatus(false)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
      {/* ── Top row: breadcrumb ── */}
      <div className="border-b border-slate-100 px-6 py-3">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Patients
        </Link>
      </div>

      {/* ── Main area ── */}
      <div className="px-6 py-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          {/* Left: name + status + medical summary */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 md:text-3xl">
                {patient.fullName}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize",
                  STATUS_BADGE[patient.status],
                )}
              >
                {patient.status}
              </span>
            </div>

            {patient.medicalHistorySummary && (
              <p className="max-w-xl text-sm leading-relaxed text-slate-500">
                {patient.medicalHistorySummary}
              </p>
            )}
          </div>

          {/* Right: contact (plain text, no box) */}
          <div className="shrink-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Contact
            </p>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              {patient.phone}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Mail className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              {patient.email}
            </div>
          </div>
        </div>

        {/* ── Bottom row: care plan + clinical status ── */}
        <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:gap-8">
          {/* Care plan progress */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Care Plan
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-slate-800">
                {clampedDone}
                <span className="font-normal text-slate-400">/{planTarget}</span>
              </p>
              <p className="text-[11px] text-slate-400">sessions</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
                aria-label={`${pct}% of care plan complete`}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden h-8 w-px bg-slate-100 sm:block" aria-hidden />

          {/* Clinical status — editable inline */}
          <div className="flex items-center gap-2">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Status
            </p>
            {editingStatus ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitStatus}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitStatus()
                  if (e.key === "Escape") {
                    setDraft(clinicalStatus)
                    setEditingStatus(false)
                  }
                }}
                autoFocus
                className="w-full max-w-xs rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-100"
                placeholder="Clinical status…"
                aria-label="Edit clinical status"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(clinicalStatus)
                  setEditingStatus(true)
                }}
                title="Click to edit"
                className="text-left text-sm text-slate-600 underline-offset-2 hover:text-sky-700 hover:underline"
              >
                {clinicalStatus}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
