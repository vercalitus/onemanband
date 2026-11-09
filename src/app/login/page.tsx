"use client"

import { Suspense, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

function LoginForm() {
  const { t } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  /**
   * Send a recovery link to the address in the form.
   *
   * The address is not checked against the user list first, on purpose: an
   * answer that differs for a real and a made-up address tells a stranger which
   * of the two they typed. Either way this reports that a link was sent.
   */
  async function handleForgot() {
    setError(null)
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      setError(t("login.error.notConfigured"))
      return
    }
    const address = email.trim()
    if (!address) {
      setError(t("login.forgot.needEmail"))
      return
    }
    setBusy(true)
    await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setBusy(false)
    setSent(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      setError(t("login.error.notConfigured"))
      return
    }
    setBusy(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      // Trimmed for the same reason the address is. A password arrives here by
      // being copied out of somewhere — and selecting a line in a text editor
      // takes the line ending with it, which is an invisible character that
      // turns a correct password into "invalid login credentials". No password
      // this system issues or accepts has meaningful whitespace at either end;
      // the change-password form trims the same way, so the two agree.
      password: password.trim(),
    })
    if (signInError) {
      setBusy(false)
      setError(t("login.error.invalid"))
      return
    }
    // Land on the originally-requested page (validated to a same-site path).
    const next = params.get("next")
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
    router.replace(dest)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-md border border-hair bg-paper p-6 sm:p-7"
    >
      <div className="mb-6">
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t("login.title")}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-mute">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {t("login.subtitle")}
        </p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <label htmlFor="login-email" className="text-sm font-medium text-mute">
            {t("login.email")}
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            dir="ltr"
            // A phone keyboard capitalises the first letter of a field and
            // corrects what it thinks is a typo. Neither is welcome in an
            // address that has to match exactly.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-hair"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="login-password" className="text-sm font-medium text-mute">
            {t("login.password")}
          </label>
          {/* A provisioned account arrives with a long random password that has
              to be typed or pasted once. Without a way to look at it, a single
              wrong character is indistinguishable from a wrong password. */}
          <div className="relative">
            <Input
              id="login-password"
              type={revealed ? "text" : "password"}
              autoComplete="current-password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-hair pe-11"
            />
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? t("login.hidePassword") : t("login.showPassword")}
              aria-pressed={revealed}
              className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-mute transition-colors hover:text-ink"
            >
              {revealed ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={handleForgot}
          disabled={busy}
          className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-3 hover:underline disabled:opacity-50"
        >
          {t("login.forgot")}
        </button>
      </div>

      {sent && (
        <p className="mt-3 rounded-md bg-cobalt-tint px-3 py-2 text-sm text-ink" role="status">
          {t("login.forgot.sent")}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-signal bg-signal-tint px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy}
        size="lg"
        className="mt-5 w-full"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        {t("login.submit")}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ground">
      {/* The cobalt band the app opens with, and its mark, so signing in
          already looks like the place it leads to. */}
      <header className="on-cobalt bg-cobalt">
        <div className="mx-auto flex min-h-24 max-w-sm items-center px-4">
          <span
            className="flex size-12 items-center justify-center rounded-md border-2 border-white font-display text-[22px] leading-none text-white"
            aria-hidden
          >
            ob
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-10 pb-16 sm:pt-16">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  )
}
