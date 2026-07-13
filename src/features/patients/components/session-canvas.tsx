"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, RotateCcw, Save } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  drawDotGrid,
  drawStrokes,
  type Stroke,
  type StrokePoint,
} from "@/features/patients/lib/canvas-strokes"

interface Props {
  /** Previously drawn vector strokes to restore (fully editable). */
  initialStrokes?: Stroke[]
  /** Called with the full stroke set whenever it changes — persisted by parent. */
  onStrokesChange: (strokes: Stroke[]) => void
  className?: string
}

/**
 * Finger/stylus-friendly drawing canvas. Strokes are kept as lightweight
 * vectors (not a PNG), so they persist across reloads and stay editable via
 * undo. Every committed change is pushed to the parent via onStrokesChange —
 * there is no "lose your work if you forget to save" trap. The Save button is
 * a reassurance flash only. Renders a nudge instead on very small screens.
 */
export function SessionCanvas({ initialStrokes, onStrokesChange, className }: Props) {
  const { t } = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const currentStroke = useRef<Stroke>([])
  const [strokes, setStrokes] = useState<Stroke[]>(() => initialStrokes ?? [])
  const [undoStack, setUndoStack] = useState<Stroke[][]>([])
  const [isMobileSmall, setIsMobileSmall] = useState(false)
  const [saved, setSaved] = useState(false)

  /** Commit a new stroke set: update state + persist upward. */
  const commit = useCallback(
    (next: Stroke[]) => {
      setStrokes(next)
      onStrokesChange(next)
    },
    [onStrokesChange],
  )

  /** Detect very small screens — skip canvas render to keep UX clean. */
  useEffect(() => {
    const check = () => setIsMobileSmall(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  /** Redraw dot grid + all committed strokes. */
  const redraw = useCallback((ctx: CanvasRenderingContext2D, allStrokes: Stroke[]) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    drawDotGrid(ctx, ctx.canvas.width, ctx.canvas.height)
    drawStrokes(ctx, allStrokes)
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    redraw(ctx, strokes)
  }, [strokes, redraw])

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure ?? 0.5,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawing.current = true
    currentStroke.current = [getPoint(e)]
    setSaved(false)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    currentStroke.current.push(getPoint(e))

    // Live preview of the in-progress stroke
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx || currentStroke.current.length < 2) return
    const pts = currentStroke.current
    const last = pts[pts.length - 2]
    const curr = pts[pts.length - 1]
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(curr.x, curr.y)
    ctx.lineWidth = 1.5 + (curr.pressure || 0.5) * 2.5
    ctx.strokeStyle = `rgba(15,23,42,${0.72 + (curr.pressure || 0.5) * 0.2})`
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
  }

  const onPointerUp = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (currentStroke.current.length > 1) {
      setUndoStack((prev) => [...prev, strokes]) // snapshot before change
      commit([...strokes, currentStroke.current])
    }
    currentStroke.current = []
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack((u) => u.slice(0, -1))
    commit(prev)
    setSaved(false)
  }

  const handleClear = () => {
    if (strokes.length === 0) return
    setUndoStack((u) => [...u, strokes])
    commit([])
    setSaved(false)
  }

  /** Strokes already auto-persist; this is just an explicit reassurance flash. */
  const handleSave = () => {
    onStrokesChange(strokes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  if (isMobileSmall) {
    return (
      <div className={cn("flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center", className)}>
        <div>
          <p className="text-sm font-semibold text-slate-600">{t("patientChart.canvas.mobileTitle")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("patientChart.canvas.mobileHint")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <p className="me-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t("patientChart.canvas.toolbarTitle")}
        </p>
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("patientChart.canvas.undoAria")}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t("patientChart.canvas.undo")}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("patientChart.canvas.clearAria")}
        >
          <Eraser className="size-3.5" aria-hidden />
          {t("patientChart.canvas.clear")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={cn(
            "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
            saved
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
          )}
          aria-label={t("patientChart.canvas.saveAria")}
        >
          <Save className="size-3.5" aria-hidden />
          {saved ? t("patientChart.canvas.saved") : t("patientChart.canvas.save")}
        </button>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="h-[320px] w-full cursor-crosshair touch-none sm:h-[400px] lg:h-[440px]"
          aria-label={t("patientChart.canvas.drawAria")}
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  )
}
