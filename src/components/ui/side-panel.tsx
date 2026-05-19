"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import type { ReactNode } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Right-side slide-in panel (drawer) built on the base-ui Dialog primitive.
 *
 * Why not Dialog directly: the standard DialogContent centres the popup. Side
 * panels need to attach to a viewport edge and slide in horizontally — the
 * differences are big enough that mashing both behaviours into one component
 * would make the props messy. Keeps each surface predictable.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  widthClassName = "w-full sm:max-w-md",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  side?: "left" | "right"
  widthClassName?: string
}) {
  const { t } = useLocale()
  const isRight = side === "right"
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/40 duration-150",
            "data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0",
            "supports-backdrop-filter:backdrop-blur-sm",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-0 z-50 flex h-dvh flex-col bg-white shadow-2xl outline-none",
            widthClassName,
            isRight ? "right-0" : "left-0",
            "duration-200",
            isRight
              ? "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
              : "data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left",
          )}
        >
          <header className="shrink-0 border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-heading text-lg font-semibold tracking-tight text-slate-900">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-1 text-sm text-slate-500">
                    {description}
                  </DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">
                    {t("common.sidePanelDescription")}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={t("common.closePanel")}
                  />
                }
              >
                <XIcon className="size-4" />
              </DialogPrimitive.Close>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5">
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
