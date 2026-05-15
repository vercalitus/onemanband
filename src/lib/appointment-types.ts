import type { AppointmentType } from "@/types/domain"

export const APPOINTMENT_TYPE_OPTIONS: AppointmentType[] = ["first", "adjustments", "kupa"]

/**
 * Visual language per appointment type — used to fill the whole appointment card
 * background so the scheduler is readable at a glance: violet=first visit,
 * emerald=regular adjustment, amber=kupa/consultation. The thin left stripe
 * stays in place to reinforce the type in tight layouts.
 */
export const appointmentTypeVisual: Record<
  AppointmentType,
  { stripe: string; surface: string; chip: string; label: string }
> = {
  first: {
    stripe: "border-l-4 border-violet-300",
    surface: "border-violet-200/80 bg-violet-50/80",
    chip: "border-violet-200 bg-violet-100/80 text-violet-700",
    label: "First",
  },
  adjustments: {
    stripe: "border-l-4 border-emerald-300",
    surface: "border-emerald-200/80 bg-emerald-50/80",
    chip: "border-emerald-200 bg-emerald-100/80 text-emerald-700",
    label: "Adjustments",
  },
  kupa: {
    stripe: "border-l-4 border-amber-300",
    surface: "border-amber-200/80 bg-amber-50/80",
    chip: "border-amber-200 bg-amber-100/80 text-amber-800",
    label: "Kupa",
  },
}
