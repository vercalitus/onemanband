"use client"

import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BodyMapView, TreatmentMark } from "@/types/domain"
import { FrontBody, FRONT_BODY_VIEWBOX } from "@/features/patients/components/body-svgs/front-body"
import { BackBody, BACK_BODY_VIEWBOX } from "@/features/patients/components/body-svgs/back-body"
import { SideBody, SIDE_BODY_VIEWBOX } from "@/features/patients/components/body-svgs/side-body"

const VIEWS: { view: BodyMapView; Svg: typeof FrontBody; viewBox: { width: number; height: number }; labelKey: string }[] = [
  { view: "front", Svg: FrontBody, viewBox: FRONT_BODY_VIEWBOX, labelKey: "patientChart.bodyMapFront" },
  { view: "side", Svg: SideBody, viewBox: SIDE_BODY_VIEWBOX, labelKey: "patientChart.bodyMapSide" },
  { view: "back", Svg: BackBody, viewBox: BACK_BODY_VIEWBOX, labelKey: "patientChart.bodyMapBack" },
]

/** Diagrams render at 85% of their column width (15% smaller than a full-bleed panel). */
const PANEL_SCALE = "85%"

function formatDate(raw: string, localeTag: string) {
  try {
    return new Date(raw).toLocaleDateString(localeTag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return raw
  }
}

const DOT_CLASSES = "bg-sky-600 shadow-md"

interface BodyMapPanelProps {
  view: BodyMapView
  Svg: typeof FrontBody
  viewBox: { width: number; height: number }
  label: string
  marks: TreatmentMark[]
  onAdd: (view: BodyMapView, x: number, y: number) => void
  onMarkClick: (mark: TreatmentMark) => void
  localeTag: string
}

function BodyMapPanel({ view, Svg, viewBox, label, marks, onAdd, onMarkClick, localeTag }: BodyMapPanelProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    onAdd(view, x, y)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        className="relative mx-auto cursor-crosshair overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70"
        style={{ width: PANEL_SCALE, aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
      >
        <Svg className="absolute inset-0 h-full w-full text-slate-500" />
        {marks.map((mark) => (
          <button
            key={mark.id}
            type="button"
            title={mark.note ? `${formatDate(mark.createdAt, localeTag)} — ${mark.note}` : formatDate(mark.createdAt, localeTag)}
            onClick={(e) => {
              e.stopPropagation()
              onMarkClick(mark)
            }}
            className={cn(
              "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-transform hover:scale-125",
              DOT_CLASSES,
            )}
            style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
          />
        ))}
      </div>
    </div>
  )
}

interface BodyMapContentProps {
  marks: TreatmentMark[]
  onAddMark: (view: BodyMapView, x: number, y: number) => void
  onUpdateNote: (id: string, note: string) => void
  onRemoveMark: (id: string) => void
}

/** The three click-to-mark diagrams + note dialog — embedded at the bottom of the patient summary card. */
export function BodyMapContent({ marks, onAddMark, onUpdateNote, onRemoveMark }: BodyMapContentProps) {
  const { t, localeTag } = useLocale()
  const [activeMark, setActiveMark] = useState<TreatmentMark | null>(null)
  const [draftNote, setDraftNote] = useState("")

  const openMark = (mark: TreatmentMark) => {
    setActiveMark(mark)
    setDraftNote(mark.note ?? "")
  }

  const closeDialog = () => {
    setActiveMark(null)
    setDraftNote("")
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {VIEWS.map(({ view, Svg, viewBox, labelKey }) => (
          <BodyMapPanel
            key={view}
            view={view}
            Svg={Svg}
            viewBox={viewBox}
            label={t(labelKey)}
            marks={marks.filter((m) => m.view === view)}
            onAdd={onAddMark}
            onMarkClick={openMark}
            localeTag={localeTag}
          />
        ))}
      </div>

      <Dialog open={activeMark !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("patientChart.bodyMapNoteTitle")}</DialogTitle>
          </DialogHeader>

          {activeMark && (
            <>
              <p className="text-xs text-slate-400">{formatDate(activeMark.createdAt, localeTag)}</p>
              <Input
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={t("patientChart.bodyMapNotePh")}
                maxLength={120}
              />
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (activeMark) onRemoveMark(activeMark.id)
                closeDialog()
              }}
            >
              {t("common.remove")}
            </Button>
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (activeMark) onUpdateNote(activeMark.id, draftNote.trim())
                closeDialog()
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
