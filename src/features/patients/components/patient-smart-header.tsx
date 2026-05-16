"use client"

import Link from "next/link"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { useRef, useState } from "react"

import { cn } from "@/lib/utils"
import type { PatientSummary } from "@/types/domain"

const STATUS_BADGE: Record<PatientSummary["status"], string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  frozen: "bg-sky-100 text-sky-800 border-sky-200",
  past: "bg-slate-100 text-slate-600 border-slate-200",
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
    <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
      {/* Dark header band */}
      <div className="rounded-t-3xl border-b border-white/10 bg-slate-900 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: breadcrumb + name + status badge */}
          <div className="min-w-0 flex-1 space-y-3">
            <Link
              href="/patients"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
            >
              <ArrowLeft className="size-3.5 stroke-[2.4]" aria-hidden />
              Patients
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                {patient.fullName}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                  STATUS_BADGE[patient.status],
                )}
              >
                {patient.status}
              </span>
            </div>

            {patient.medicalHistorySummary && (
              <p className="max-w-2xl text-sm leading-relaxed text-slate-300/90">
                {patient.medicalHistorySummary}
              </p>
            )}
          </div>

          {/* Right: contact */}
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 lg:min-w-[240px]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Contact
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <Phone className="size-3.5 text-sky-400" aria-hidden />
              {patient.phone}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
              <Mail className="size-3.5 text-sky-400" aria-hidden />
              {patient.email}
            </div>
          </div>
        </div>
      </div>

      {/* White band: care plan + clinical status */}
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Care plan progress */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Care Plan
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
              {clampedDone}/{planTarget}
            </p>
            <p className="text-[11px] text-slate-400">sessions</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-sky-500" : "bg-amber-400",
              )}
              style={{ width: `${pct}%` }}
              aria-label={`${pct}% of care plan complete`}
            />
          </div>
        </div>

        {/* Clinical status — editable inline */}
        <div className="flex shrink-0 items-center gap-2 sm:max-w-xs">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
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
              className="w-full rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
              title="Click to edit clinical status"
              className="text-left text-sm leading-snug text-slate-600 underline-offset-2 hover:text-sky-700 hover:underline"
            >
              {clinicalStatus}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
