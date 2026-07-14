"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isSupabaseConfigured } from "@/lib/env"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

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

  const card = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold text-slate-900">{t("security.mfa.title")}</h2>
        <p className="text-sm leading-relaxed text-slate-600">{t("security.mfa.subtitle")}</p>
      </div>

      {status === "loading" && (
        <div className={`${card} flex items-center gap-2 text-sm text-slate-500`}>
          <Loader2 className="size-4 animate-spin text-sky-600" /> {t("security.mfa.loading")}
        </div>
      )}

      {status === "unavailable" && (
        <div className={`${card} flex items-start gap-3`}>
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <p className="text-sm text-slate-600">{t("security.mfa.unavailable")}</p>
        </div>
      )}

      {status === "off" && (
        <div className={card}>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium text-slate-900">{t("security.mfa.off.title")}</p>
              <p className="mt-0.5 text-sm text-slate-600">{t("security.mfa.off.hint")}</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={startEnrollment}
            disabled={busy}
            className="mt-4 h-11 rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-700"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {t("security.mfa.enable")}
          </Button>
        </div>
      )}

      {status === "enrolling" && enrollment && (
        <div className={card}>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                1
              </span>
              <div className="flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <Smartphone className="size-4 text-slate-400" /> {t("security.mfa.step.scan")}
                </p>
                {/* qr_code is a self-contained SVG data URI from Supabase — safe to render directly. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrollment.qrCode}
                  alt={t("security.mfa.step.scan")}
                  className="mt-3 size-44 rounded-xl border border-slate-200 bg-white p-2"
                />
                <p className="mt-2 text-xs text-slate-500">{t("security.mfa.step.manual")}</p>
                <code className="mt-1 block break-all rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700">
                  {enrollment.secret}
                </code>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                2
              </span>
              <div className="flex-1">
                <label htmlFor="mfa-enroll-code" className="text-sm font-medium text-slate-800">
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
                  className="mt-2 h-11 max-w-[12rem] rounded-xl border-slate-200 text-center font-mono text-lg tracking-[0.4em] tabular-nums"
                />
              </div>
            </li>
          </ol>

          {error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              onClick={confirmEnrollment}
              disabled={busy || code.length < 6}
              className="h-11 rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-700"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {t("security.mfa.confirm")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEnrollment(null)
                setCode("")
                setError(null)
                setStatus("off")
              }}
              className="h-11 rounded-xl"
            >
              {t("security.mfa.cancel")}
            </Button>
          </div>
        </div>
      )}

      {status === "on" && (
        <div className={card}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
            <div className="flex-1">
              <p className="font-medium text-slate-900">{t("security.mfa.on.title")}</p>
              <p className="mt-0.5 text-sm text-slate-600">{t("security.mfa.on.hint")}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={disableMfa}
            disabled={busy}
            className="mt-4 h-11 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("security.mfa.disable")}
          </Button>
        </div>
      )}
    </div>
  )
}
