"use client"

import { Globe } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Locale } from "@/lib/i18n/types"
import { cn } from "@/lib/utils"

const OPTIONS: Locale[] = ["en", "he"]

/** Header language picker — persists locale + syncs RTL + typography with LocaleProvider */
export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-9 shrink-0 gap-1.5 border-slate-200 px-2.5 text-sky-700",
        )}
        aria-label={t("locale.menuLabel")}
      >
        <Globe className="size-[15px] shrink-0" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tabular-nums">{locale === "he" ? "עב" : "EN"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[10rem] p-2">
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          {OPTIONS.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              <span className="flex flex-1 items-center justify-between gap-2 font-medium">
                <span>{code === "en" ? t("locale.english") : t("locale.hebrew")}</span>
                <span className="text-xs text-muted-foreground" aria-hidden>
                  {code.toUpperCase()}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
