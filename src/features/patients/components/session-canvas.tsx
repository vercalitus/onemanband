"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, RotateCcw, Save } from "lucide-react"

import { cn } from "@/lib/utils"

interface Point {
  x: number
  y: number
  pressure: number
}

type Stroke = Point[]

interface Props {
  initialDataUrl?: string | null
  onSave: (dataUrl: string) => void
  className?: string
}

/**
 * Finger/stylus-friendly drawing canvas with dot-grid background,
 * per-stroke undo, clear, and save-to-PNG. Renders nothing on very small
 * screens (< sm) and shows a friendly nudge instead.
 */
export function SessionCanvas({ initialDataUrl, onSave, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const currentStroke = useRef<Stroke>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]) // history snapshots
  const [isMobileSmall, setIsMobileSmall] = useState(false)
  const [saved, setSaved] = useState(false)

  /** Detect very small screens — skip canvas render to keep UX clean. */
  useEffect(() => {
    const check = () => setIsMobileSmall(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  /** Draw the dot-grid background + all strokes. */
  const redraw = useCallback(
    (ctx: CanvasRenderingContext2D, allStrokes: Stroke[]) => {
      const { width, height } = ctx.canvas
      ctx.clearRect(0, 0, width, height)

      // Dot grid
      ctx.save()
      ctx.fillStyle = "rgba(100,116,139,0.12)" // subtle slate dot
      const gap = 24
      for (let y = gap; y < height; y += gap) {
        for (let x = gap; x < width; x += gap) {
          ctx.beginPath()
          ctx.arc(x, y, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      // Restore initial image (if any) underneath strokes
      if (initialDataUrl) {
        const img = new Image()
        img.src = initialDataUrl
        img.onload = () => {
          ctx.save()
          ctx.globalAlpha = 0.6
          ctx.drawImage(img, 0, 0, width, height)
          ctx.restore()
          drawStrokes(ctx, allStrokes)
        }
        return
      }

      drawStrokes(ctx, allStrokes)
    },
    [initialDataUrl],
  )

  function drawStrokes(ctx: CanvasRenderingContext2D, allStrokes: Stroke[]) {
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) {
        const pressure = stroke[i].pressure || 0.5
        ctx.lineWidth = 1.5 + pressure * 2.5
        ctx.strokeStyle = `rgba(15,23,42,${0.72 + pressure * 0.2})`
        ctx.lineTo(stroke[i].x, stroke[i].y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(stroke[i].x, stroke[i].y)
      }
    }
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    redraw(ctx, strokes)
  }, [strokes, redraw])

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
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

    // Live preview of current stroke
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
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
      setUndoStack((prev) => [...prev, strokes]) // save snapshot before
      setStrokes((prev) => [...prev, currentStroke.current])
    }
    currentStroke.current = []
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setStrokes(prev)
    setUndoStack((u) => u.slice(0, -1))
    setSaved(false)
  }

  const handleClear = () => {
    setUndoStack((u) => [...u, strokes])
    setStrokes([])
    setSaved(false)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    onSave(dataUrl)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  if (isMobileSmall) {
    return (
      <div className={cn("flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center", className)}>
        <div>
          <p className="text-sm font-semibold text-slate-600">Handwriting canvas</p>
          <p className="mt-1 text-xs text-slate-400">Open on a tablet for stylus / finger drawing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <p className="mr-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Handwritten notes
        </p>
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Undo last stroke"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Clear canvas"
        >
          <Eraser className="size-3.5" aria-hidden />
          Clear
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
          aria-label="Save drawing"
        >
          <Save className="size-3.5" aria-hidden />
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
        <canvas
          ref={canvasRef}
          width={1200}
          height={480}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="h-[320px] w-full cursor-crosshair touch-none sm:h-[400px] lg:h-[440px]"
          aria-label="Handwriting canvas — draw notes with finger or stylus"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  )
}
