import type { MessageTemplate } from "@/types/automation"

/**
 * Placeholder substitution for message copy.
 *
 * Kept deliberately dumb — `{name}` in, value out, unknown placeholders left
 * visible rather than blanked. A half-rendered message that reads
 * "your appointment on {date}" is an obvious bug; one that reads "your
 * appointment on " looks fine and ships broken.
 */

export interface TemplateContext {
  patient_name?: string
  clinic_name?: string
  date?: string
  time?: string
  amount?: string
  link?: string
  session_number?: number | string
  practitioner_name?: string
}

/** Placeholders the Automations editor advertises to the user. */
export const TEMPLATE_PLACEHOLDERS = [
  "patient_name",
  "clinic_name",
  "date",
  "time",
  "amount",
  "link",
  "session_number",
  "practitioner_name",
] as const

export function renderTemplateString(body: string, ctx: TemplateContext): string {
  return body.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = ctx[key as keyof TemplateContext]
    return value === undefined || value === "" ? whole : String(value)
  })
}

export function renderTemplate(
  template: MessageTemplate,
  ctx: TemplateContext,
): { body: string; subject?: string } {
  return {
    body: renderTemplateString(template.body, ctx),
    subject: template.emailSubject ? renderTemplateString(template.emailSubject, ctx) : undefined,
  }
}

/** Placeholders present in a body that the given context cannot fill. */
export function missingPlaceholders(body: string, ctx: TemplateContext): string[] {
  const found = body.match(/\{(\w+)\}/g) ?? []
  return [...new Set(found.map((m) => m.slice(1, -1)))].filter(
    (key) => ctx[key as keyof TemplateContext] === undefined,
  )
}
