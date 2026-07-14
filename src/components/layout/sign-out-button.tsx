"use client"

import { LogOut } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { isSupabaseConfigured } from "@/lib/env"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * Sign-out control. Renders only when Supabase auth is active; in mock mode
 * there is no session, so it stays hidden and the header looks as it did.
 */
export function SignOutButton() {
  const { t } = useLocale()

  if (!isSupabaseConfigured()) return null

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase?.auth.signOut()
    // Full reload so middleware re-evaluates and lands us on /login.
    window.location.href = "/login"
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={handleSignOut}
      className="shrink-0 border-slate-100 bg-white shadow-none"
      aria-label={t("header.signOut")}
    >
      <LogOut className="size-4 text-slate-500" />
    </Button>
  )
}
