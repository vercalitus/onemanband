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

const OPTIONS: Locale[] = ["en", "he", "ar"]

const LOCALE_BADGE: Record<Locale, string> = {
  en: "EN",
  he: "עב",
  ar: "عر",
}

const LOCALE_LABEL_KEY: Record<Locale, string> = {
  en: "locale.english",
  he: "locale.hebrew",
  ar: "locale.arabic",
}

/** Header language picker — persists locale + syncs RTL + typography with LocaleProvider */
export function LocaleSwitcher({ variant = "plate" }: { variant?: "plate" | "rail" }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-11 shrink-0 gap-1.5 rounded-md border-white/25 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white",
          variant === "rail" && "w-[76px] border-transparent text-white/80",
        )}
        aria-label={t("locale.menuLabel")}
      >
        <Globe className="size-[15px] shrink-0" aria-hidden />
        <span className="text-[13px] font-bold uppercase tabular-nums">{LOCALE_BADGE[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[10rem] p-2">
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          {OPTIONS.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              <span className="flex flex-1 items-center justify-between gap-2 font-medium">
                <span>{t(LOCALE_LABEL_KEY[code])}</span>
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
