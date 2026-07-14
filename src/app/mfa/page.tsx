"use client"

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2, ShieldCheck } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

function MfaChallenge() {
  const { t } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const startedRef = useRef(false)

  // Find the practitioner's verified TOTP factor to challenge against.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      const supabase = createSupabaseBrowserClient()
      if (!supabase) {
        setError(t("mfa.error.notConfigured"))
        setReady(true)
        return
      }
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      const totp = data?.totp?.find((f) => f.status === "verified") ?? data?.totp?.[0]
      if (listError || !totp) {
        setError(t("mfa.error.noFactor"))
        setReady(true)
        return
      }
      setFactorId(totp.id)
      setReady(true)
    })()
  }, [t])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!factorId) return
    const supabase = createSupabaseBrowserClient()
    if (!supabase) return
    setError(null)
    setBusy(true)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })
    if (challengeError || !challenge) {
      setBusy(false)
      setError(t("mfa.error.invalid"))
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })
    if (verifyError) {
      setBusy(false)
      setCode("")
      setError(t("mfa.error.invalid"))
      return
    }
    const next = params.get("next")
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
    router.replace(dest)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl"
    >
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <ShieldCheck className="size-6 stroke-[1.6]" />
        </span>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-slate-900">
          {t("mfa.title")}
        </h1>
        <p className="text-sm text-slate-500">{t("mfa.subtitle")}</p>
      </div>

      <div className="grid gap-1.5">
        <label
          htmlFor="mfa-code"
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
        >
          {t("mfa.code")}
        </label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="h-12 rounded-xl border-slate-200 text-center font-mono text-lg tracking-[0.4em] tabular-nums"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-600">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy || !ready || !factorId || code.length < 6}
        className="mt-5 h-11 w-full rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-700"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        {t("mfa.verify")}
      </Button>
    </form>
  )
}

export default function MfaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={null}>
        <MfaChallenge />
      </Suspense>
    </main>
  )
}
