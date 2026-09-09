"use client"

import { useEffect, useMemo, useState } from "react"
import { FileUp, Loader2, X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PublicNotice, PublicShell } from "@/features/automations/components/public-shell"
import { SlotPicker } from "@/features/automations/components/slot-picker"
import { randomId, upsertIntake } from "@/features/automations/lib/automation-store"
import { findFreeSlots, type FreeSlot } from "@/features/automations/lib/availability"
import { useBusySlots } from "@/features/automations/lib/use-busy-slots"
import { markTokenUsed } from "@/features/automations/lib/automation-store"
import { resolveToken } from "@/features/automations/lib/tokens"
import { readClinicSettings } from "@/lib/clinic-settings-storage"
import { cn } from "@/lib/utils"
import type { AppointmentType } from "@/types/domain"
import type { ClinicSettings } from "@/types/clinic-settings"
import type { PatientIntake } from "@/types/automation"

type Stage = "loading" | "invalid" | "disabled" | "details" | "slot" | "done"

const CONTROL =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"

/**
 * Patient self-registration and first booking.
 *
 * Order matters here: details and documents come before the slot, so the
 * clinic never ends up holding a calendar slot for someone it has no way to
 * contact. Nothing written here becomes a real patient record — it lands as a
 * `PatientIntake` for the practitioner to approve, because this is
 * self-reported data arriving from an unauthenticated link.
 */
export function BookPageClient({ token }: { token: string }) {
  const { t } = useLocale()
  const busySlots = useBusySlots(token)
  const [stage, setStage] = useState<Stage>("loading")
  const [reason, setReason] = useState("")
  const [settings, setSettings] = useState<ClinicSettings | null>(null)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [visitReason, setVisitReason] = useState("")
  const [documents, setDocuments] = useState<IntakeDocument[]>([])
  const [type, setType] = useState<AppointmentType>("first")
  const [error, setError] = useState("")

  useEffect(() => {
    const loaded = readClinicSettings()
    setSettings(loaded)
    const resolution = resolveToken(token, "book")
    if (!resolution.ok) {
      setReason(resolution.reason)
      setStage("invalid")
      return
    }
    if (!loaded.automations.selfBooking.enabled) {
      setStage("disabled")
      return
    }
    setStage("details")
  }, [token])

  const allowedTypes = useMemo(() => {
    if (!settings) return []
    const allowed = new Set(settings.automations.selfBooking.allowedTypes)
    return settings.treatmentTypes.filter((row) => allowed.has(row.type))
  }, [settings])

  const slots = useMemo<FreeSlot[]>(() => {
    // Nothing offered until the clinic's real diary has been read. Drawing the
    // week as free and then removing slots would hand out a time somebody has
    // already tapped.
    if (!settings || stage !== "slot" || busySlots === null) return []
    const duration =
      settings.treatmentTypes.find((x) => x.type === type)?.defaultMinutes ?? 30
    return findFreeSlots({
      automations: settings.automations,
      weekdays: settings.weekdays,
      appointments: busySlots ?? [],
      durationMinutes: duration,
      limit: 120,
    })
  }, [settings, stage, type, busySlots])

  const clinicName = settings?.profile.clinicName ?? ""

  const goToSlots = () => {
    if (!fullName.trim() || !phone.trim()) {
      setError(t("public.book.errorRequired"))
      return
    }
    if (settings?.automations.selfBooking.requireDocuments && !documents.length) {
      setError(t("public.book.errorDocuments"))
      return
    }
    setError("")
    setStage("slot")
  }

  /**
   * Send the registration to the clinic.
   *
   * To the server first: this page runs on the patient's phone, and an intake
   * kept in this browser's storage is one the clinic will never see — which is
   * exactly what used to happen. The local store is only the demo's path, taken
   * when the server says it has no store; any other failure is shown, because
   * "done" on screen with nothing filed anywhere is the worst outcome here.
   */
  const submit = async (slot: FreeSlot) => {
    const intake: PatientIntake = {
      id: randomId("intake"),
      token,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      dateOfBirth: dateOfBirth || undefined,
      reason: visitReason.trim(),
      // Storage paths once uploaded; the demo, which stores nothing, keeps names.
      documentNames: documents.map((doc) => doc.path || doc.name),
      requestedType: type,
      requestedDate: slot.date,
      requestedStart: slot.start,
      status: "submitted",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    }

    let answer: { ok: boolean; reason?: string } | null = null
    try {
      const res = await fetch("/api/automations/public/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fullName: intake.fullName,
          phone: intake.phone,
          email: intake.email,
          dateOfBirth: intake.dateOfBirth,
          reason: intake.reason,
          documentNames: intake.documentNames,
          requestedType: intake.requestedType,
          requestedDate: intake.requestedDate,
          requestedStart: intake.requestedStart,
        }),
      })
      answer = (await res.json()) as { ok: boolean; reason?: string }
    } catch {
      answer = null
    }

    if (answer?.ok) {
      setStage("done")
      return
    }
    if (answer?.reason === "no store") {
      upsertIntake(intake)
      markTokenUsed(token)
      setStage("done")
      return
    }
    setError(t("public.book.errorSubmit"))
  }

  if (stage === "loading") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.book.title")}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin text-sky-600" aria-hidden />
          {t("public.loading")}
        </div>
      </PublicShell>
    )
  }

  if (stage === "invalid") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.book.title")}>
        <PublicNotice
          tone="error"
          title={t(`public.token.${reason}`)}
          body={t("public.token.contactClinic")}
        />
      </PublicShell>
    )
  }

  if (stage === "disabled") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.book.title")}>
        <PublicNotice tone="info" title={t("public.book.disabled")} />
      </PublicShell>
    )
  }

  if (stage === "done") {
    return (
      <PublicShell clinicName={clinicName} title={t("public.book.title")}>
        <PublicNotice
          tone="success"
          title={t("public.book.doneTitle")}
          body={t("public.book.doneBody")}
        />
      </PublicShell>
    )
  }

  if (stage === "slot") {
    return (
      <PublicShell
        clinicName={clinicName}
        title={t("public.book.slotTitle")}
        subtitle={t("public.book.slotSubtitle")}
      >
        <SlotPicker slots={slots} onPick={submit} emptyLabel={t("public.slots.none")} />
        <Button variant="ghost" className="mt-4 text-slate-600" onClick={() => setStage("details")}>
          {t("public.back")}
        </Button>
      </PublicShell>
    )
  }

  return (
    <PublicShell
      clinicName={clinicName}
      title={t("public.book.title")}
      subtitle={t("public.book.subtitle")}
    >
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Field label={t("public.book.fullName")} required>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={CONTROL}
            autoComplete="name"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("public.book.phone")} required>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={CONTROL}
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
          <Field label={t("public.book.email")}>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={CONTROL}
              inputMode="email"
              autoComplete="email"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("public.book.dob")}>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={CONTROL}
            />
          </Field>
          <Field label={t("public.book.type")}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AppointmentType)}
              className={cn(CONTROL, "appearance-none")}
            >
              {allowedTypes.map((row) => (
                <option key={row.type} value={row.type}>
                  {row.label} · {row.defaultMinutes}m
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t("public.book.reason")}>
          <textarea
            value={visitReason}
            onChange={(e) => setVisitReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </Field>

        <DocumentPicker
          token={token}
          documents={documents}
          onChange={setDocuments}
          required={Boolean(settings?.automations.selfBooking.requireDocuments)}
        />

        {error ? (
          <p className="text-sm font-medium text-[rgb(171,119,93)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button className="h-11 w-full text-base" onClick={goToSlots}>
          {t("public.book.continue")}
        </Button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">{t("public.book.privacy")}</p>
    </PublicShell>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
        {required ? <span className="text-[rgb(171,119,93)]"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

/** A file the patient attached: where it went, and what they called it. */
interface IntakeDocument {
  /** Empty in the demo, which transmits nothing and keeps the name. */
  path: string
  name: string
}

/**
 * Document upload.
 *
 * Each file goes to the clinic's private bucket the moment it is chosen,
 * under an `intakes/` folder the registration will point at. It used to keep
 * the file *name* and transmit nothing, so a patient who attached three scans
 * had, as far as the clinic could ever tell, attached three strings. The demo
 * — a deploy with no store — still keeps names, because that is what it has.
 */
function DocumentPicker({
  token,
  documents,
  onChange,
  required,
}: {
  token: string
  documents: IntakeDocument[]
  onChange: (next: IntakeDocument[]) => void
  required: boolean
}) {
  const { t } = useLocale()
  const [uploading, setUploading] = useState(0)
  const [failed, setFailed] = useState<string | null>(null)

  const upload = async (files: File[]) => {
    setFailed(null)
    setUploading((n) => n + files.length)
    const added: IntakeDocument[] = []
    for (const file of files) {
      try {
        const form = new FormData()
        form.append("token", token)
        form.append("file", file)
        const res = await fetch("/api/automations/public/intake-file", { method: "POST", body: form })
        const body = (await res.json()) as { ok: boolean; path?: string; reason?: string }
        if (body.ok && body.path) added.push({ path: body.path, name: file.name })
        else if (body.reason === "no store") added.push({ path: "", name: file.name })
        else setFailed(file.name)
      } catch {
        setFailed(file.name)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (added.length) onChange([...documents, ...added])
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {t("public.book.documents")}
        {required ? <span className="text-[rgb(171,119,93)]"> *</span> : null}
      </span>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3.5 py-3 text-sm text-slate-600 transition-colors hover:border-sky-400">
        <FileUp className="size-4 text-sky-600" aria-hidden />
        {uploading > 0 ? t("public.book.uploading") : t("public.book.documentsHint")}
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          disabled={uploading > 0}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) void upload(files)
            e.target.value = ""
          }}
        />
      </label>
      {failed ? (
        <p className="mt-2 text-sm font-medium text-[rgb(171,119,93)]" role="alert">
          {t("public.book.uploadFailed", { name: failed })}
        </p>
      ) : null}
      {documents.length ? (
        <ul className="mt-2 space-y-1.5">
          {documents.map((doc, i) => (
            <li
              key={`${doc.path || doc.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <span className="truncate">{doc.name}</span>
              <button
                type="button"
                aria-label={`${t("public.book.removeDocument")}: ${doc.name}`}
                onClick={() => onChange(documents.filter((_, idx) => idx !== i))}
                className="shrink-0 text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
