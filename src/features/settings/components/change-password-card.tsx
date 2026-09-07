"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isSupabaseConfigured } from "@/lib/env"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * Change the signed-in practitioner's password.
 *
 * This exists because an account provisioned by someone else starts life with a
 * password that person chose and transmitted. Without a screen like this the
 * practitioner can never make it his own, and the clinic's records sit behind a
 * secret two people know.
 *
 * The current password is verified server-side first (see
 * `/api/account/verify-password`) so a session left open on an unlocked machine
 * is not enough to take the account over. The change itself runs on the
 * browser's own session, which keeps this device signed in.
 */

/**
 * Longer than Supabase's default six. These accounts open 1,178 medical
 * records, and the practitioner types this once a day at most.
 */
const MIN_LENGTH = 10

type Field = "current" | "next" | "confirm"

export function ChangePasswordCard() {
  const { t } = useLocale()
  const [values, setValues] = useState<Record<Field, string>>({
    current: "",
    next: "",
    confirm: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const configured = isSupabaseConfigured()
  const set = (field: Field, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setDone(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)

    if (values.next.length < MIN_LENGTH) {
      setError(t("security.password.error.short", { min: MIN_LENGTH }))
      return
    }
    if (values.next !== values.confirm) {
      setError(t("security.password.error.mismatch"))
      return
    }
    if (values.next === values.current) {
      setError(t("security.password.error.same"))
      return
    }

    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      setError(t("security.password.error.generic"))
      return
    }

    setBusy(true)

    const check = await fetch("/api/account/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: values.current }),
    })
    if (!check.ok) {
      setBusy(false)
      setError(
        check.status === 401
          ? t("security.password.error.current")
          : t("security.password.error.generic"),
      )
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: values.next })
    setBusy(false)
    if (updateError) {
      setError(t("security.password.error.generic"))
      return
    }

    setValues({ current: "", next: "", confirm: "" })
    setDone(true)
  }

  const card = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
  const label = "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
  const field = "h-11 rounded-xl border-slate-200"

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold text-slate-900">
          {t("security.password.title")}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">{t("security.password.subtitle")}</p>
      </div>

      {!configured ? (
        <div className={`${card} text-sm text-slate-600`}>{t("security.password.unavailable")}</div>
      ) : (
        <form onSubmit={handleSubmit} className={card}>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="password-current" className={label}>
                {t("security.password.current")}
              </label>
              <Input
                id="password-current"
                type="password"
                autoComplete="current-password"
                required
                dir="ltr"
                value={values.current}
                onChange={(e) => set("current", e.target.value)}
                className={field}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="password-next" className={label}>
                {t("security.password.next")}
              </label>
              <Input
                id="password-next"
                type="password"
                autoComplete="new-password"
                required
                dir="ltr"
                value={values.next}
                onChange={(e) => set("next", e.target.value)}
                className={field}
              />
              <p className="text-xs text-slate-500">
                {t("security.password.hint", { min: MIN_LENGTH })}
              </p>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="password-confirm" className={label}>
                {t("security.password.confirm")}
              </label>
              <Input
                id="password-confirm"
                type="password"
                autoComplete="new-password"
                required
                dir="ltr"
                value={values.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                className={field}
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}
          {done && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              {t("security.password.success")}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="mt-4 h-11 rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-700"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {t("security.password.submit")}
          </Button>
        </form>
      )}
    </div>
  )
}
