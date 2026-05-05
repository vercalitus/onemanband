import type { AppointmentType } from "@/types/domain"

export const APPOINTMENT_TYPE_OPTIONS: AppointmentType[] = ["first", "adjustments", "kupa"]

/**
 * Visual language aligned with dashboard pastels (sky / sage / peach).
 * Used for left stripe + small chips on calendar blocks.
 */
export const appointmentTypeVisual: Record<
  AppointmentType,
  { stripe: string; chip: string; label: string }
> = {
  first: {
    stripe: "border-l-4 border-[rgb(150,182,197)]",
    chip: "border-[rgb(224,236,244)] bg-[rgb(233,242,248)] text-[rgb(91,123,138)]",
    label: "First",
  },
  adjustments: {
    stripe: "border-l-4 border-[rgb(120,157,138)]",
    chip: "border-[rgb(223,237,230)] bg-[rgb(232,242,238)] text-[rgb(92,123,110)]",
    label: "Adjustments",
  },
  kupa: {
    stripe: "border-l-4 border-[rgb(240,186,159)]",
    chip: "border-[rgb(248,228,214)] bg-[rgb(255,247,242)] text-[rgb(171,119,93)]",
    label: "Kupa",
  },
}
