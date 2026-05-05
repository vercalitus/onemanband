"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DayCalendarView } from "@/features/dashboard/components/day-calendar-view"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { getNavItemByHref, navBadgeCaption } from "@/lib/navigation"
import { todaySchedule } from "@/lib/mock-data"
import { CalendarSync, Clock3, MessageSquareText } from "lucide-react"
import { useState } from "react"

export default function CalendarPage() {
  const nav = getNavItemByHref("/calendar")!
  const [dayAppointments, setDayAppointments] = useState(() => [...todaySchedule])

  return (
    <div className="space-y-8">
      <section className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            {navBadgeCaption(nav.description)}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-slate-900">{nav.label}</h1>
        </div>
        <div className="inline-flex items-center rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.08)]">
          Google sync ready
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className={`min-h-[520px] ${elevatedCardClass}`}>
          <CardHeader className={darkCardHeaderClass}>
            <div className="flex items-center gap-2.5">
              <Clock3 className="size-5 stroke-[1.6] text-sky-400" />
              <CardTitle className="text-xl font-bold tracking-tight text-white">Integrated Schedule</CardTitle>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/60">
              Same day grid as the dashboard. 5-minute slots; no overlapping visits.
            </p>
          </CardHeader>
          <CardContent className={`${elevatedCardBodyClass} pb-5`}>
            <DayCalendarView appointments={dayAppointments} onAppointmentsChange={setDayAppointments} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className={elevatedCardClass}>
            <CardHeader className={darkCardHeaderClass}>
              <div className="flex items-center gap-2.5">
                <CalendarSync className="size-5 stroke-[1.6] text-sky-400" />
                <CardTitle className="text-xl font-bold tracking-tight text-white">Google Calendar Sync</CardTitle>
              </div>
            </CardHeader>
            <CardContent className={`${elevatedCardBodyClass} space-y-3 text-sm leading-6 text-slate-500`}>
              <p>1. Exchange tokens with Google Workspace account.</p>
              <p>2. Store `google_calendar_event_id` per appointment.</p>
              <p>3. Reconcile updates through a Supabase Edge Function queue.</p>
            </CardContent>
          </Card>

          <Card className={elevatedCardClass}>
            <CardHeader className={darkCardHeaderClass}>
              <div className="flex items-center gap-2.5">
                <MessageSquareText className="size-5 stroke-[1.6] text-sky-400" />
                <CardTitle className="text-xl font-bold tracking-tight text-white">Reminder Automations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className={`${elevatedCardBodyClass} space-y-2 text-sm leading-6 text-slate-500`}>
              <p>Channels: WhatsApp, SMS fallback, and email.</p>
              <p>Trigger window: 24h and 2h before start time.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
