"use client"

import Link from "next/link"
import { FolderOpen } from "lucide-react"
import { useMemo, useState } from "react"

import type { AppointmentStatus, ScheduleItem } from "@/types/domain"
import { appointmentTypeVisual } from "@/lib/appointment-types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const statusCycle: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]

const cardTone: Record<AppointmentStatus, string> = {
  scheduled: "border-[rgb(224,236,244)] bg-white shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]",
  confirmed: "border-[rgb(223,237,230)] bg-white shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]",
  checked_in: "border-slate-100 bg-white shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]",
  completed: "border-[rgb(223,237,230)] bg-white shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]",
  cancelled: "border-[rgb(248,228,214)] bg-white shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]",
  no_show: "border-[rgb(248,228,214)] bg-white shadow-[0_20px_60px_rgb(46_74_66_/_0.02)]",
}

const badgeTone: Record<AppointmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "outline",
  confirmed: "default",
  checked_in: "outline",
  completed: "secondary",
  cancelled: "destructive",
  no_show: "destructive",
}

function getNextStatus(status: AppointmentStatus) {
  const currentIndex = statusCycle.indexOf(status)
  const nextIndex = (currentIndex + 1) % statusCycle.length
  return statusCycle[nextIndex]
}

function formatStatus(status: AppointmentStatus) {
  return status.replace("_", " ")
}

const dotTone: Record<AppointmentStatus, string> = {
  scheduled: "bg-[rgb(150,182,197)] shadow-[0_0_0_5px_rgba(150,182,197,0.18)]",
  confirmed: "bg-[rgb(120,157,138)] shadow-[0_0_0_5px_rgba(120,157,138,0.18)]",
  checked_in: "bg-slate-300 shadow-[0_0_0_5px_rgba(148,163,184,0.1)]",
  completed: "bg-[rgb(120,157,138)] shadow-[0_0_0_5px_rgba(120,157,138,0.15)]",
  cancelled: "bg-[rgb(240,186,159)] shadow-[0_0_0_5px_rgba(248,228,214,0.5)]",
  no_show: "bg-[rgb(240,186,159)] shadow-[0_0_0_5px_rgba(248,228,214,0.5)]",
}

const statusBadgeTone: Record<AppointmentStatus, string> = {
  scheduled: "border-[rgb(224,236,244)] bg-[rgb(233,242,248)] text-[rgb(91,123,138)]",
  confirmed: "border-[rgb(223,237,230)] bg-[rgb(232,242,238)] text-[rgb(92,123,110)]",
  checked_in: "border-slate-200 bg-slate-50 text-slate-600",
  completed: "border-[rgb(223,237,230)] bg-[rgb(232,242,238)] text-[rgb(92,123,110)]",
  cancelled: "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]",
  no_show: "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getAvatarTone(patientId: string) {
  const tones = [
    "bg-[rgba(150,182,197,0.16)] text-[rgb(91,123,138)]",
    "bg-[rgba(120,157,138,0.14)] text-[rgb(92,123,110)]",
    "bg-[rgba(150,182,197,0.12)] text-[rgb(91,123,138)]",
    "bg-[rgb(252,248,241)] text-[rgb(141,122,91)]",
  ]

  const numericPart = Number.parseInt(patientId.replace(/\D/g, ""), 10) || 0

  return tones[numericPart % tones.length]
}

export function AppointmentCard({
  appointment,
}: {
  appointment: ScheduleItem
}) {
  const [status, setStatus] = useState<AppointmentStatus>(appointment.status)

  const nextStatusLabel = useMemo(() => formatStatus(getNextStatus(status)), [status])

  return (
    <div className="relative">
      <span className={cn("absolute -left-[21px] top-6 size-[10px] rounded-full ring-4 ring-[#F9FAFB]", dotTone[status])} />
      <div
        className={cn(
          "relative rounded-3xl border p-4 backdrop-blur-md transition-all duration-200 hover:-translate-y-px",
          cardTone[status]
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <Avatar size="sm" className="mt-0.5">
                <AvatarFallback className={cn("text-[11px] font-semibold", getAvatarTone(appointment.patientId))}>
                  {getInitials(appointment.patientName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="font-mono font-semibold tabular-nums text-slate-700">{appointment.start}</span>
                  <span>to</span>
                  <span className="font-mono tabular-nums">{appointment.end}</span>
                  <span className="rounded-full bg-[rgb(249,246,241)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    {appointment.dayLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                    {appointment.patientName}
                  </p>
                  <Link
                    href={`/patients/${appointment.patientId}?tab=records`}
                    className="rounded-xl border border-slate-100 p-1.5 text-slate-400 transition-colors duration-200 hover:bg-[rgb(249,246,241)] hover:text-slate-700"
                    aria-label={`Open medical records for ${appointment.patientName}`}
                  >
                    <FolderOpen className="size-4 stroke-[1.8]" />
                  </Link>
                </div>
                <p className="text-sm leading-6 text-slate-500">{appointment.treatment}</p>
                <p className="pt-1">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${appointmentTypeVisual[appointment.appointmentType].chip}`}
                  >
                    {appointmentTypeVisual[appointment.appointmentType].label}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-auto rounded-full px-0 py-0 shadow-none hover:bg-transparent"
            onClick={() => setStatus(getNextStatus(status))}
            title={`Change status to ${nextStatusLabel}`}
          >
            <Badge
              variant={badgeTone[status]}
              className={cn("cursor-pointer capitalize", statusBadgeTone[status])}
            >
              {formatStatus(status)}
            </Badge>
          </Button>
        </div>
      </div>
    </div>
  )
}
