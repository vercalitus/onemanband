"use client"

import { LogOut } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { isSupabaseConfigured } from "@/lib/env"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/**
 * Sign-out control. Renders only when Supabase auth is active; in mock mode
 * there is no session, so it stays hidden and the header looks as it did.
 */
export function SignOutButton({ variant = "plate" }: { variant?: "plate" | "rail" }) {
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
      className={cn(
        "size-11 shrink-0 rounded-md border-white/25 bg-transparent text-white shadow-none hover:bg-white/10 hover:text-white",
        variant === "rail" && "w-[76px] border-transparent text-white/80",
      )}
      aria-label={t("header.signOut")}
    >
      <LogOut className="size-4" />
    </Button>
  )
}
