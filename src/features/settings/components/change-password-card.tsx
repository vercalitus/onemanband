"use client"

import { useState, type FormEvent } from "react"
import { KeyRound, Loader2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AttentionNote,
  SettingsField,
  SettingsSection,
  StateLine,
  hintClass,
  inputClass,
} from "@/features/settings/components/settings-ui"
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

    // Trimmed the same way the sign-in form trims, so a password set here is a
    // password that can be typed back in. Letting one end in a space that the
    // login screen then strips would lock the account out of itself.
    const current = values.current.trim()
    const next = values.next.trim()
    const confirm = values.confirm.trim()

    if (next.length < MIN_LENGTH) {
      setError(t("security.password.error.short", { min: MIN_LENGTH }))
      return
    }
    if (next !== confirm) {
      setError(t("security.password.error.mismatch"))
      return
    }
    if (next === current) {
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
      body: JSON.stringify({ password: current }),
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

    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updateError) {
      setError(t("security.password.error.generic"))
      return
    }

    setValues({ current: "", next: "", confirm: "" })
    setDone(true)
  }

  return (
    <SettingsSection title={t("security.password.title")} description={t("security.password.subtitle")}>
      {!configured ? (
        <p className={hintClass}>{t("security.password.unavailable")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md">
          <div className="grid gap-5">
            <SettingsField label={t("security.password.current")}>
              <Input
                id="password-current"
                type="password"
                autoComplete="current-password"
                required
                dir="ltr"
                value={values.current}
                onChange={(e) => set("current", e.target.value)}
                className={inputClass}
              />
            </SettingsField>
            <SettingsField
              label={t("security.password.next")}
              hint={t("security.password.hint", { min: MIN_LENGTH })}
            >
              <Input
                id="password-next"
                type="password"
                autoComplete="new-password"
                required
                dir="ltr"
                value={values.next}
                onChange={(e) => set("next", e.target.value)}
                className={inputClass}
              />
            </SettingsField>
            <SettingsField label={t("security.password.confirm")}>
              <Input
                id="password-confirm"
                type="password"
                autoComplete="new-password"
                required
                dir="ltr"
                value={values.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                className={inputClass}
              />
            </SettingsField>
          </div>

          {error && <AttentionNote className="mt-4">{error}</AttentionNote>}
          {done && (
            <p className="mt-4" role="status">
              <StateLine state="done">{t("security.password.success")}</StateLine>
            </p>
          )}

          <Button type="submit" disabled={busy} className="mt-5 gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {t("security.password.submit")}
          </Button>
        </form>
      )}
    </SettingsSection>
  )
}
