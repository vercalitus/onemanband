"use client"

import { useEffect, useState, type FormEvent } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/components/providers/locale-provider"

/**
 * Lightweight dialog for adding a custom Clinical Feed source. URL is optional
 * — at this stage we only track display data; backend ingestion (RSS / API)
 * will be wired in a later iteration.
 */
export function AddSourceDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { name: string; url?: string }) => void
}) {
  const { t } = useLocale()
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setUrl("")
  }, [open])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, url: url.trim() || undefined })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90dvh,calc(100dvh-2rem))] min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogDescription className="sr-only">{t("addSource.srOnly")}</DialogDescription>

        {/* The dialog's own plate, as on the other dialogs. */}
        <DialogHeader className="on-cobalt flex min-h-20 shrink-0 flex-row items-center gap-4 bg-cobalt px-6 py-3 text-start text-white">
          <DialogTitle className="min-w-0 flex-1 truncate text-[22px] leading-tight font-bold text-white">
            {t("addSource.title")}
          </DialogTitle>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-white/25 bg-transparent text-white hover:bg-white/10"
                aria-label={t("common.close")}
              />
            }
          >
            <XIcon />
          </DialogClose>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
            <div className="grid gap-5">
              <div className="grid gap-1.5">
                <label htmlFor="src-name" className="text-sm font-medium text-mute">
                  {t("addSource.label.name")}
                </label>
                <Input
                  id="src-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("addSource.ph.name")}
                  required
                  autoFocus
                  className="border-hair"
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="src-url" className="text-sm font-medium text-mute">
                  {t("addSource.label.url")}
                </label>
                <Input
                  id="src-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t("addSource.ph.url")}
                  type="url"
                  dir="ltr"
                  className="border-hair"
                />
                <p className="text-sm leading-snug text-mute">{t("addSource.hint.ingestion")}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="m-0 shrink-0 flex-row justify-end gap-2 rounded-none border-t border-hair bg-ground px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("addSource.footer.cancel")}
            </Button>
            <Button type="submit" className="min-w-[7.5rem]">
              {t("addSource.footer.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
