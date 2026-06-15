"use client"

import { CalendarPlus, UserPlus, XIcon } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/components/providers/locale-provider"
import type { PatientSummary } from "@/types/domain"
import { cn } from "@/lib/utils"

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"

const CONTROL =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition-[border-color,box-shadow] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-200"

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (patient: PatientSummary) => void
}) {
  const { t } = useLocale()
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
    setFullName("")
    setPhone("")
    setEmail("")
    setDob("")
    setComplaint("")
    setKupaId("clalit")
    setReferralId("google")
    setFirstVisit("")
    setPlanChoice(10)
    setCustomPlan("8")
  }, [open])

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
      phone: phone.trim() || "—",
      email: emailTrim || "—",
      status: "active",
      lastVisit: visitIso,
      balance: "₪0",
      tags: [],
      medicalHistorySummary: complaint.trim() || t("addPatient.defaultComplaint"),
      generalNotes: generalParts.filter(Boolean).join(" · "),
    }

    onSave(patient)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92dvh,calc(100dvh-1rem))] min-h-0 w-full flex-col gap-0 overflow-hidden rounded-3xl border-slate-200/90 p-0 shadow-2xl sm:max-w-xl",
        )}
      >
        <DialogDescription className="sr-only">{t("addPatient.srOnly")}</DialogDescription>

        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-5 end-5 z-20 rounded-xl text-white hover:bg-white/15"
              aria-label={t("common.close")}
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="relative shrink-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-6 pb-4 pt-5 text-white">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
          <DialogHeader className="relative gap-0 space-y-0">
            <DialogTitle className="font-heading flex items-center gap-2 pe-12 text-xl font-semibold tracking-tight text-white">
              <UserPlus className="size-5 shrink-0 text-sky-300" aria-hidden />
              {t("addPatient.title")}
            </DialogTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-50 ring-1 ring-white/15">
                {t("addPatient.intakeBadge")}
              </span>
              <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-sky-100">
                <CalendarPlus className="size-4 shrink-0 text-sky-300" aria-hidden />
                <span>{t("addPatient.optionalVisitHint")}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-6 py-5">
            {error ? (
              <p className="rounded-xl border border-rose-200/90 bg-rose-50 px-3 py-2.5 text-sm text-rose-800" role="alert">
                {error}
              </p>
            ) : null}

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-slate-900">{t("addPatient.section.personal")}</h3>
                <p className="mt-1 text-xs text-slate-500">{t("addPatient.section.personalHint")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="np-name" className={LABEL}>
                    {t("addPatient.label.fullName")} <span className="text-rose-600">*</span>
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

            <Separator />

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-slate-900">{t("addPatient.section.coverage")}</h3>
                <p className="mt-1 text-xs text-slate-500">{t("addPatient.section.coverageHint")}</p>
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
                  <select id="np-ref" value={referralId} onChange={(e) => setReferralId(e.target.value as ReferralId)} className={cn(CONTROL, "mt-1.5 appearance-none")}>
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
                  <p className="mt-1.5 text-[11px] text-slate-400">{t("addPatient.hint.scheduleMock")}</p>
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
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        planChoice === n
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {t("addPatient.plan.sessions", { n })}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPlanChoice("custom")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      planChoice === "custom"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
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

          <DialogFooter className="relative z-[1] mx-0 mb-0 mt-0 shrink-0 rounded-b-3xl border-t border-slate-200/95 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-xl min-w-[6.5rem]" onClick={() => onOpenChange(false)}>
              {t("addPatient.footer.cancel")}
            </Button>
            <Button type="submit" className="h-11 min-w-[7.5rem] rounded-xl bg-emerald-700 px-6 font-semibold text-white hover:bg-emerald-800">
              {t("addPatient.footer.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
