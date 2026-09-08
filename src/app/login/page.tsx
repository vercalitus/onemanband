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
      className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl"
    >
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <ShieldCheck className="size-6 stroke-[1.6]" />
        </span>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-slate-900">
          {t("login.title")}
        </h1>
        <p className="text-sm text-slate-500">{t("login.subtitle")}</p>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label
            htmlFor="login-email"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
          >
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
            className="h-11 rounded-xl border-slate-200"
          />
        </div>
        <div className="grid gap-1.5">
          <label
            htmlFor="login-password"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
          >
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
              className="h-11 rounded-xl border-slate-200 pe-11"
            />
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? t("login.hidePassword") : t("login.showPassword")}
              aria-pressed={revealed}
              className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
            >
              {revealed ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-600">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy}
        className="mt-5 h-11 w-full rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-700"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        {t("login.submit")}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
