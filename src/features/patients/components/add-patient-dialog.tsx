"use client"

import { AlertTriangle, ExternalLink, FileText, XIcon } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/components/providers/locale-provider"
import type { AddPatientPrefill, IntakeReview, PatientSummary } from "@/types/domain"
import { cn } from "@/lib/utils"

/** What the practitioner decided about the registration while saving. */
export interface AddPatientSaveOptions {
  /** Book the slot the patient asked for, on the record just created. */
  bookRequestedSlot: boolean
}

const LABEL = "text-sm font-medium text-mute"

const CONTROL =
  "h-11 w-full rounded-md border border-hair bg-paper px-3 text-[17px] text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/20"

/** A choice among a few: 44px, hairline, cobalt when chosen. */
const CHOICE =
  "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
const CHOICE_ON = "border-cobalt bg-cobalt font-bold text-white"
const CHOICE_OFF = "border-hair bg-paper text-ink hover:bg-ground"

const TEXTAREA = cn(CONTROL, "min-h-[104px] resize-y py-3 leading-relaxed")

const KUPA_IDS = ["clalit", "maccabi", "leumit", "meuhedet", "idf", "selfpay"] as const
const REFERRAL_IDS = ["google", "physician", "friend", "walkin", "marketing", "other"] as const

const PLAN_PRESETS = [4, 10, 12, 20] as const

type KupahId = (typeof KUPA_IDS)[number]
type ReferralId = (typeof REFERRAL_IDS)[number]
type PlanChoice = (typeof PLAN_PRESETS)[number] | "custom"

export function AddPatientDialog({
  open,
  onOpenChange,
  onSave,
  initial,
  intake,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (patient: PatientSummary, options: AddPatientSaveOptions) => void
  /** Seeded into the form on open — what a self-registration already said. */
  initial?: AddPatientPrefill
  /** The registration's slot and files, for review. Absent for a walk-in. */
  intake?: IntakeReview
}) {
  const { t, localeTag } = useLocale()
  const hasRequestedSlot = !!(intake?.requestedDate && intake?.requestedStart)
  const [bookSlot, setBookSlot] = useState(true)
  const [openingPath, setOpeningPath] = useState<string | null>(null)

  /** Signed on demand, opened in a tab. A link that outlives the click is a leak. */
  const openIntakeFile = async (path: string) => {
    if (!intake) return
    setOpeningPath(path)
    try {
      const res = await fetch("/api/automations/intakes/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeId: intake.intakeId, path }),
      })
      const body = (await res.json()) as { ok: boolean; url?: string }
      if (body.ok && body.url) window.open(body.url, "_blank", "noopener,noreferrer")
    } catch {
      /* the file stays listed; the practitioner can try again */
    } finally {
      setOpeningPath(null)
    }
  }
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [complaint, setComplaint] = useState("")
  const [kupaId, setKupaId] = useState<KupahId>("clalit")
  const [referralId, setReferralId] = useState<ReferralId>("google")
  const [firstVisit, setFirstVisit] = useState("")
  const [planChoice, setPlanChoice] = useState<PlanChoice>(10)
  const [customPlan, setCustomPlan] = useState("8")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setFullName(initial?.fullName ?? "")
    setPhone(initial?.phone ?? "")
    setEmail(initial?.email ?? "")
    setDob(initial?.dateOfBirth ?? "")
    setComplaint(initial?.complaint ?? "")
    setBookSlot(true)
    setKupaId("clalit")
    setReferralId("google")
    setFirstVisit("")
    setPlanChoice(10)
    setCustomPlan("8")
  }, [open, initial])

  function resolveSessionCount(): number {
    if (planChoice === "custom") {
      const n = Number.parseInt(customPlan, 10)
      if (!Number.isFinite(n) || n < 1 || n > 99) return 8
      return n
    }
    return planChoice
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) {
      setError(t("addPatient.errName"))
      return
    }
    const emailTrim = email.trim()
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError(t("addPatient.errEmail"))
      return
    }

    const sessions = resolveSessionCount()
    const today = new Date().toISOString().slice(0, 10)
    const visitIso = firstVisit.trim() || today
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `pt-${crypto.randomUUID().slice(0, 10)}`
        : `pt-${Date.now()}`

    const kupaLabel = t(`addPatient.kupa.${kupaId}`)
    const referralLabel = t(`addPatient.referral.${referralId}`)

    const generalParts = [
      dob && t("addPatient.notes.partDob", { dob }),
      t("addPatient.notes.partKupa", { kupa: kupaLabel }),
      t("addPatient.notes.partReferral", { referral: referralLabel }),
      t("addPatient.notes.partPlan", { n: sessions }),
      firstVisit.trim()
        ? t("addPatient.notes.firstVisitDate", { date: firstVisit })
        : t("addPatient.notes.firstVisitProvisional", { date: visitIso }),
    ]

    const patient: PatientSummary = {
      id,
      fullName: name,
      // Empty stays empty. This used to store "—" as the phone number, and a
      // dash is not "no number" to anything downstream: the reminder engine
      // saw a phone, the "no way to reach" signal saw a phone, and neither
      // could reach anyone.
      phone: phone.trim(),
      email: emailTrim,
      dateOfBirth: dob || undefined,
      status: "active",
      lastVisit: visitIso,
      balance: "₪0",
      tags: [],
      medicalHistorySummary: complaint.trim() || t("addPatient.defaultComplaint"),
      generalNotes: generalParts.filter(Boolean).join(" · "),
      // The plan chosen here is the patient's plan, not a note about one. It
      // used to survive only as text in the general notes, and the chart then
      // measured their visits against the practice default.
      carePlanSessions: sessions,
    }

    onSave(patient, { bookRequestedSlot: hasRequestedSlot && bookSlot })
    onOpenChange(false)
  }

  const requestedSlotLabel = hasRequestedSlot
    ? t("addPatient.intake.requested", {
        date: new Date(`${intake!.requestedDate}T00:00:00`).toLocaleDateString(localeTag, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        time: intake!.requestedStart ?? "",
        type: intake?.requestedType ? t(`appt.type.${intake.requestedType}`) : "",
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92dvh,calc(100dvh-1rem))] min-h-0 w-full flex-col gap-0 overflow-hidden rounded-md bg-paper p-0 sm:max-w-xl",
        )}
      >
        <DialogDescription className="sr-only">{t("addPatient.srOnly")}</DialogDescription>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 end-3 z-20 text-ink"
              aria-label={t("common.close")}
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="shrink-0 border-b border-hair px-6 pb-4 pt-5">
          <DialogHeader className="gap-1 space-y-0">
            <DialogTitle className="pe-12 text-[22px] leading-tight font-bold text-ink">
              {t("addPatient.title")}
            </DialogTitle>
            <p className="text-sm text-mute">
              {t("addPatient.intakeBadge")} · {t("addPatient.optionalVisitHint")}
            </p>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-6 py-5">
            {error ? (
              <p className="flex items-start gap-2.5 rounded-md border border-ink/30 bg-sunk px-3 py-2.5 text-[17px] font-medium text-ink" role="alert">
                <AlertTriangle className="mt-1 size-4 shrink-0 stroke-[2]" aria-hidden />
                {error}
              </p>
            ) : null}

            {/* What the patient sent, beside what they typed. Reviewed here
                rather than on a separate screen: the decision is one decision
                — this person becomes a patient, with this slot and these
                files — and it should be made in one place. */}
            {intake ? (
              <section className="space-y-3 rounded-md border border-hair p-4">
                <h3 className="text-[17px] font-bold text-ink">
                  {t("addPatient.intake.title")}
                </h3>
                {hasRequestedSlot ? (
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[17px] text-ink">
                    <input
                      type="checkbox"
                      checked={bookSlot}
                      onChange={(e) => setBookSlot(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 rounded-[4px] accent-cobalt"
                    />
                    <span>
                      <span className="block font-medium">{t("addPatient.intake.bookSlot")}</span>
                      <span className="block text-sm text-mute">{requestedSlotLabel}</span>
                    </span>
                  </label>
                ) : (
                  <p className="text-sm text-mute">{t("addPatient.intake.noSlot")}</p>
                )}
                <div>
                  <p className={LABEL}>{t("addPatient.intake.documents")}</p>
                  {intake.documents.length ? (
                    <ul className="mt-1.5">
                      {intake.documents.map((doc) => (
                        <li
                          key={doc.path || doc.name}
                          className="flex min-h-11 items-center justify-between gap-2 border-b border-hair-soft text-[17px] text-ink last:border-b-0"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-mute" aria-hidden />
                            <span className="truncate">{doc.name}</span>
                          </span>
                          {doc.path ? (
                            <button
                              type="button"
                              disabled={openingPath === doc.path}
                              onClick={() => void openIntakeFile(doc.path)}
                              className="flex min-h-11 shrink-0 items-center gap-1 px-1 text-sm font-medium text-cobalt underline decoration-1 underline-offset-3 disabled:opacity-50"
                            >
                              {t("addPatient.intake.open")}
                              <ExternalLink className="size-3" aria-hidden />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-mute">{t("addPatient.intake.noDocuments")}</p>
                  )}
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              <div>
                <h3 className="text-[17px] font-bold text-ink">{t("addPatient.section.personal")}</h3>
                <p className="mt-0.5 text-sm text-mute">{t("addPatient.section.personalHint")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="np-name" className={LABEL}>
                    {t("addPatient.label.fullName")} <span className="text-ink">*</span>
                  </label>
                  <Input id="np-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" required />
                </div>
                <div>
                  <label htmlFor="np-phone" className={LABEL}>
                    {t("addPatient.label.phone")}
                  </label>
                  <Input id="np-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <label htmlFor="np-email" className={LABEL}>
                    {t("addPatient.label.email")}
                  </label>
                  <Input id="np-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="np-dob" className={LABEL}>
                    {t("addPatient.label.dob")}
                  </label>
                  <Input id="np-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div>
                <label htmlFor="np-complaint" className={LABEL}>
                  {t("addPatient.label.complaint")}
                </label>
                <textarea
                  id="np-complaint"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder={t("addPatient.ph.complaint")}
                  rows={4}
                  className={cn(TEXTAREA, "mt-1.5")}
                />
              </div>
            </section>

            <div className="border-t border-hair" aria-hidden />

            <section className="space-y-4">
              <div>
                <h3 className="text-[17px] font-bold text-ink">{t("addPatient.section.coverage")}</h3>
                <p className="mt-0.5 text-sm text-mute">{t("addPatient.section.coverageHint")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="np-kupa" className={LABEL}>
                    {t("addPatient.label.kupa")}
                  </label>
                  <select id="np-kupa" value={kupaId} onChange={(e) => setKupaId(e.target.value as KupahId)} className={cn(CONTROL, "mt-1.5")}>
                    {KUPA_IDS.map((id) => (
                      <option key={id} value={id}>
                        {t(`addPatient.kupa.${id}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="np-ref" className={LABEL}>
                    {t("addPatient.label.referral")}
                  </label>
                  <select id="np-ref" value={referralId} onChange={(e) => setReferralId(e.target.value as ReferralId)} className={cn(CONTROL, "mt-1.5")}>
                    {REFERRAL_IDS.map((id) => (
                      <option key={id} value={id}>
                        {t(`addPatient.referral.${id}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="np-first" className={LABEL}>
                    {t("addPatient.label.firstVisit")}
                  </label>
                  <Input id="np-first" type="date" value={firstVisit} onChange={(e) => setFirstVisit(e.target.value)} className="mt-1.5" />
                  <p className="mt-1.5 text-sm text-mute">{t("addPatient.hint.scheduleMock")}</p>
                </div>
              </div>

              <div>
                <span className={LABEL}>{t("addPatient.label.planLength")}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PLAN_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPlanChoice(n)}
                      aria-pressed={planChoice === n}
                      className={cn(CHOICE, planChoice === n ? CHOICE_ON : CHOICE_OFF)}
                    >
                      {t("addPatient.plan.sessions", { n })}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPlanChoice("custom")}
                    aria-pressed={planChoice === "custom"}
                    className={cn(CHOICE, planChoice === "custom" ? CHOICE_ON : CHOICE_OFF)}
                  >
                    {t("addPatient.plan.custom")}
                  </button>
                </div>
                {planChoice === "custom" ? (
                  <div className="mt-3 max-w-[10rem]">
                    <label htmlFor="np-custom-plan" className={LABEL}>
                      {t("addPatient.label.customCount")}
                    </label>
                    <Input
                      id="np-custom-plan"
                      type="number"
                      min={1}
                      max={99}
                      value={customPlan}
                      onChange={(e) => setCustomPlan(e.target.value)}
                      className="mt-1.5 tabular-nums"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <DialogFooter className="relative z-[1] mx-0 mb-0 mt-0 shrink-0 rounded-b-md border-t border-hair bg-paper px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
            <Button type="button" variant="outline" className="min-w-[6.5rem]" onClick={() => onOpenChange(false)}>
              {t("addPatient.footer.cancel")}
            </Button>
            <Button type="submit" className="h-12 min-w-[7.5rem] px-6">
              {t("addPatient.footer.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
