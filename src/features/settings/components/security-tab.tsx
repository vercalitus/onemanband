"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StateMark } from "@/components/ui/state-mark"
import { ChangePasswordCard } from "@/features/settings/components/change-password-card"
import {
  AttentionNote,
  SettingsSection,
  SettingsSheet,
  hintClass,
  inputClass,
} from "@/features/settings/components/settings-ui"
import { isSupabaseConfigured } from "@/lib/env"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Status = "loading" | "off" | "enrolling" | "on" | "unavailable"

interface Enrollment {
  factorId: string
  qrCode: string
  secret: string
}

/**
 * Two-factor (TOTP) setup for the practitioner. Enrolls an authenticator-app
 * factor, verifies it, and lets the user disable it. Once a verified factor
 * exists the middleware forces a TOTP challenge on every sign-in.
 */
export function SecurityTab() {
  const { t } = useLocale()
  const [status, setStatus] = useState<Status>("loading")
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const loadedRef = useRef(false)

  const refreshStatus = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      setStatus("unavailable")
      return
    }
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.some((f) => f.status === "verified")
    setStatus(verified ? "on" : "off")
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    if (!isSupabaseConfigured()) {
      setStatus("unavailable")
      return
    }
    void refreshStatus()
  }, [refreshStatus])

  async function startEnrollment() {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) return
    setError(null)
    setBusy(true)
    // Clear any half-finished (unverified) factors so re-enrolling never collides.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.totp ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator",
    })
    setBusy(false)
    if (enrollError || !data) {
      setError(t("security.mfa.error.enroll"))
      return
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setStatus("enrolling")
  }

  async function confirmEnrollment() {
    const supabase = createSupabaseBrowserClient()
    if (!supabase || !enrollment) return
    setError(null)
    setBusy(true)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    })
    if (challengeError || !challenge) {
      setBusy(false)
      setError(t("security.mfa.error.verify"))
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })
    setBusy(false)
    if (verifyError) {
      setCode("")
      setError(t("security.mfa.error.verify"))
      return
    }
    setEnrollment(null)
    setCode("")
    setStatus("on")
  }

  async function disableMfa() {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) return
    setBusy(true)
    const { data } = await supabase.auth.mfa.listFactors()
    for (const f of data?.totp ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    setBusy(false)
    await refreshStatus()
  }

  return (
    <SettingsSheet className="max-w-2xl">
      {/* Password first: a provisioned account arrives with a password someone
          else chose, and making it his own is the first thing to do here. */}
      <ChangePasswordCard />

      <SettingsSection title={t("security.mfa.title")} description={t("security.mfa.subtitle")}>
        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-mute">
            <Loader2 className="size-4 animate-spin text-cobalt" /> {t("security.mfa.loading")}
          </p>
        )}

        {status === "unavailable" && (
          <p className="flex items-start gap-2 text-sm leading-snug text-mute">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ink" />
            {t("security.mfa.unavailable")}
          </p>
        )}

        {status === "off" && (
          <div>
            <div className="flex items-start gap-3">
              <StateMark state="unsure" className="mt-1.5" />
              <div className="flex-1">
                <p className="text-[17px] font-medium text-ink">{t("security.mfa.off.title")}</p>
                <p className={cn(hintClass, "mt-0.5")}>{t("security.mfa.off.hint")}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={startEnrollment}
              disabled={busy}
              className="mt-4 gap-2"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {t("security.mfa.enable")}
            </Button>
          </div>
        )}

        {status === "enrolling" && enrollment && (
          <div>
            <ol className="space-y-5">
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink text-sm font-bold tabular-nums text-ink">
                  1
                </span>
                <div className="flex-1">
                  <p className="flex items-center gap-1.5 text-[17px] font-medium text-ink">
                    <Smartphone className="size-4 text-mute" /> {t("security.mfa.step.scan")}
                  </p>
                  {/* qr_code is a self-contained SVG data URI from Supabase — safe to render directly. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={enrollment.qrCode}
                    alt={t("security.mfa.step.scan")}
                    className="mt-3 size-44 rounded-md border border-hair bg-paper p-2"
                  />
                  <p className={cn(hintClass, "mt-2")}>{t("security.mfa.step.manual")}</p>
                  <code className="mt-1 block break-all rounded-md bg-ground px-2.5 py-1.5 font-mono text-sm text-ink">
                    {enrollment.secret}
                  </code>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink text-sm font-bold tabular-nums text-ink">
                  2
                </span>
                <div className="flex-1">
                  <label htmlFor="mfa-enroll-code" className="text-[17px] font-medium text-ink">
                    {t("security.mfa.step.enter")}
                  </label>
                  <Input
                    id="mfa-enroll-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    dir="ltr"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className={cn(inputClass, "mt-2 max-w-[12rem] text-center font-mono text-[22px] tracking-[0.4em] tabular-nums")}
                  />
                </div>
              </li>
            </ol>

            {error && <AttentionNote className="mt-4">{error}</AttentionNote>}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={confirmEnrollment}
                disabled={busy || code.length < 6}
                className="gap-2 border-cobalt"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {t("security.mfa.confirm")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEnrollment(null)
                  setCode("")
                  setError(null)
                  setStatus("off")
                }}
              >
                {t("security.mfa.cancel")}
              </Button>
            </div>
          </div>
        )}

        {status === "on" && (
          <div>
            <div className="flex items-start gap-3">
              <StateMark state="done" className="mt-1.5" />
              <div className="flex-1">
                <p className="text-[17px] font-medium text-ink">{t("security.mfa.on.title")}</p>
                <p className={cn(hintClass, "mt-0.5")}>{t("security.mfa.on.hint")}</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={disableMfa} disabled={busy} className="mt-4 gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("security.mfa.disable")}
            </Button>
          </div>
        )}
      </SettingsSection>
    </SettingsSheet>
  )
}
