"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, RotateCcw } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  drawDotGrid,
  drawStrokeDot,
  drawStrokeSegment,
  drawStrokes,
  inkPressure,
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

/** How long the pen may rest before the draft is handed to the parent. */
const PERSIST_DELAY_MS = 600
/** Samples closer than this in canvas units add nothing but weight. */
const MIN_SAMPLE_DISTANCE = 0.75
const MAX_UNDO_DEPTH = 60

/**
 * A context that draws in canvas units whatever the backing store's size.
 * Every drawing path goes through here, so none of them can be left working in
 * device pixels.
 */
function inkContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  const ctx = canvas?.getContext("2d")
  if (!ctx) return null
  const scale = ctx.canvas.width / CANVAS_WIDTH
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  return ctx
}

/**
 * Finger/stylus-friendly drawing canvas. Strokes are kept as lightweight
 * vectors (not a PNG), so they persist across reloads and stay editable via
 * undo. Every committed change is pushed to the parent via onStrokesChange —
 * there is no "lose your work if you forget to save" trap, and so no Save
 * button. Renders a nudge instead on very small screens.
 *
 * Three things about writing on a tablet, each learned from a practitioner
 * writing on one mid-treatment:
 *
 *  - **Nothing here is text.** Without that said explicitly, a drag that the
 *    pen handler ignores — a palm, a finger after the pen — becomes a text
 *    selection, and the card under the hand turns blue; a pen held still
 *    becomes a long-press, and the tablet offers to save the canvas as an
 *    image, over the session being written.
 *  - **The stroke set is not React state.** It lives in a ref and is handed
 *    upward after the pen rests. It used to go up on every lift, where it was
 *    written to storage, broadcast, and re-rendered the whole chart — the
 *    three-dimensional skeleton in the header included — so the ink stuttered
 *    every time a letter finished.
 *  - **A full redraw is for undo and resize only.** Redrawing every stroke
 *    after each new one is quadratic, and a page of handwriting is thousands
 *    of segments. The ink that is already on the canvas stays on it.
 */
export function SessionCanvas({ initialStrokes, onStrokesChange, className }: Props) {
  const { t } = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /** The strokes themselves — the truth, deliberately outside React. */
  const strokesRef = useRef<Stroke[]>(initialStrokes ?? [])
  const undoRef = useRef<Stroke[][]>([])
  const currentStroke = useRef<Stroke>([])
  /** Index of the last point whose segment has already been inked. */
  const drawnUpTo = useRef(0)
  /** The canvas box, read once per stroke rather than once per sample. */
  const rectRef = useRef<DOMRect | null>(null)

  /**
   * The one contact that is drawing, and whether a pen has ever been used.
   *
   * A stylus hand rests on the glass. Each palm contact used to arrive as a
   * new pointer-down that replaced the stroke in progress — the pen went
   * quiet mid-word, and what had been written was lost — and the palm itself
   * was drawn as a stroke. So: one pointer draws at a time, and once a pen
   * has touched the canvas, fingers and palms are not strokes.
   */
  const activePointer = useRef<number | null>(null)
  const penSeen = useRef(false)

  /** Only what the toolbar needs — this is the component's entire render input. */
  const [counts, setCounts] = useState({
    strokes: initialStrokes?.length ?? 0,
    undo: 0,
  })
  const [isMobileSmall, setIsMobileSmall] = useState(false)

  /* ---------------------------------------------------------------- persist */

  /** The set waiting to be handed upward, and the last set we handed up. */
  const pending = useRef<Stroke[] | null>(null)
  const emitted = useRef<Stroke[] | undefined>(initialStrokes)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onStrokesChange)
  onChangeRef.current = onStrokesChange

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    if (!next) return
    pending.current = null
    emitted.current = next
    onChangeRef.current(next)
  }, [])

  const commit = useCallback(
    (next: Stroke[]) => {
      strokesRef.current = next
      setCounts({ strokes: next.length, undo: undoRef.current.length })
      pending.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, PERSIST_DELAY_MS)
    },
    [flush],
  )

  /**
   * Hand the draft up before anything else can act on it: closing the session
   * reads the strokes from the parent, and that button is one tap away from
   * the canvas. A pointer landing anywhere else on the page settles the draft
   * first — pointerdown runs before the click it turns into.
   */
  useEffect(() => {
    const settle = (e: Event) => {
      if (e.target instanceof Node && canvasRef.current?.contains(e.target)) return
      flush()
    }
    const onHide = () => flush()
    document.addEventListener("pointerdown", settle, true)
    window.addEventListener("pagehide", onHide)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("pointerdown", settle, true)
      window.removeEventListener("pagehide", onHide)
      document.removeEventListener("visibilitychange", onHide)
      flush()
    }
  }, [flush])

  /* ----------------------------------------------------------------- render */

  /** Detect very small screens — skip canvas render to keep UX clean. */
  useEffect(() => {
    const check = () => setIsMobileSmall(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  /** Dot grid + every stroke. For undo, clear, resize and hydration only. */
  const redrawAll = useCallback(() => {
    const ctx = inkContext(canvasRef.current)
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    drawDotGrid(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)
    drawStrokes(ctx, strokesRef.current)

    // The stroke still under the pen belongs to nobody yet — it is not in the
    // set and is only on the glass. A redraw that skipped it would rub out the
    // word being written, which is exactly when a redraw is least welcome.
    const live = currentStroke.current
    if (live.length === 1) drawStrokeDot(ctx, live[0])
    else for (let i = 1; i < live.length; i++) drawStrokeSegment(ctx, live, i)
    drawnUpTo.current = Math.max(live.length - 1, 0)
  }, [])

  /**
   * Match the backing store to the element and the screen's density. A canvas
   * left at its default resolution is resampled by the browser, which is why
   * ink on a retina tablet looked soft next to the text beside it. The height
   * is derived from the width so the two axes always share one scale.
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fit = () => {
      const rect = canvas.getBoundingClientRect()
      rectRef.current = rect
      if (!rect.width) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(rect.width * dpr)
      const height = Math.round((width * CANVAS_HEIGHT) / CANVAS_WIDTH)
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      redrawAll()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [redrawAll])

  /**
   * Adopt a stroke set the parent replaced — closing a session clears the
   * draft, and the canvas has to clear with it or the next patient's session
   * opens on the last one's handwriting. Our own commits come back by
   * reference and are ignored.
   */
  useEffect(() => {
    if (initialStrokes === emitted.current) return
    emitted.current = initialStrokes
    pending.current = null
    strokesRef.current = initialStrokes ?? []
    undoRef.current = []
    setCounts({ strokes: strokesRef.current.length, undo: 0 })
    redrawAll()
  }, [initialStrokes, redrawAll])

  /* ---------------------------------------------------------------- drawing */

  const toPoint = (clientX: number, clientY: number, pressure: number): StrokePoint => {
    const rect = rectRef.current ?? canvasRef.current!.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
      pressure: inkPressure(pressure),
    }
  }

  /** Append a sample unless it lands on top of the last one. */
  const addPoint = (point: StrokePoint) => {
    const pts = currentStroke.current
    const last = pts[pts.length - 1]
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_SAMPLE_DISTANCE) return
    pts.push(point)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "pen") penSeen.current = true
    if (e.pointerType === "touch" && penSeen.current) return
    if (activePointer.current !== null) return
    e.preventDefault()
    activePointer.current = e.pointerId
    rectRef.current = e.currentTarget.getBoundingClientRect()
    currentStroke.current = [toPoint(e.clientX, e.clientY, e.pressure)]
    drawnUpTo.current = 0
    // Last, and allowed to fail: capture throws if the contact is already gone
    // by the time this runs, and a throw here used to leave the stroke holding
    // the *previous* stroke's points — every sample after it landed in a stroke
    // that had already been committed.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* no such pointer any more — the stroke still draws, it just is not captured */
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointer.current) return
    e.preventDefault()

    // Everything the digitiser recorded since the last frame, not just the
    // sample that woke React. A pen reports several times faster than the
    // screen refreshes, and dropping the rest is what made a fast stroke
    // arrive as a run of straight lines.
    const native = e.nativeEvent
    const coalesced =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : []
    const samples = coalesced.length > 0 ? coalesced : [native]
    for (const sample of samples) {
      addPoint(toPoint(sample.clientX, sample.clientY, sample.pressure))
    }

    const ctx = inkContext(canvasRef.current)
    if (!ctx) return
    const pts = currentStroke.current
    // The newest sample is the curve's end control point, so it is inked on
    // the next one — half a sample behind the tip, invisible at pen rates.
    for (let i = Math.max(drawnUpTo.current, 1); i < pts.length - 1; i++) {
      drawStrokeSegment(ctx, pts, i)
      drawnUpTo.current = i + 1
    }
  }

  const finishStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current === null) return
    if (e && e.pointerId !== activePointer.current) return
    activePointer.current = null

    const pts = currentStroke.current
    currentStroke.current = []
    // A cancelled pointer — the browser took the contact for a gesture —
    // still commits what was drawn. Losing half a word is worse than a
    // slightly short stroke.
    if (pts.length === 0) return

    const ctx = inkContext(canvasRef.current)
    if (ctx && pts.length === 1) {
      drawStrokeDot(ctx, pts[0])
    } else if (ctx) {
      for (let i = Math.max(drawnUpTo.current, 1); i < pts.length; i++) {
        drawStrokeSegment(ctx, pts, i)
      }
    }

    undoRef.current = [...undoRef.current, strokesRef.current].slice(-MAX_UNDO_DEPTH)
    commit([...strokesRef.current, pts])
  }

  const handleUndo = () => {
    const stack = undoRef.current
    if (stack.length === 0) return
    undoRef.current = stack.slice(0, -1)
    commit(stack[stack.length - 1])
    redrawAll()
  }

  const handleClear = () => {
    if (strokesRef.current.length === 0) return
    undoRef.current = [...undoRef.current, strokesRef.current].slice(-MAX_UNDO_DEPTH)
    commit([])
    redrawAll()
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
    <div className={cn("flex flex-col gap-2 select-none", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <p className="me-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t("patientChart.canvas.toolbarTitle")}
        </p>
        <button
          type="button"
          onClick={handleUndo}
          disabled={counts.undo === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("patientChart.canvas.undoAria")}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t("patientChart.canvas.undo")}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={counts.strokes === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("patientChart.canvas.clearAria")}
        >
          <Eraser className="size-3.5" aria-hidden />
          {t("patientChart.canvas.clear")}
        </button>
      </div>

      {/* There used to be a Save button here. It saved nothing the draft had
          not already kept, and a practitioner pressed it expecting the session
          to be recorded and closed — then found the pen still writing. The one
          action that records a session is Complete Session; this says so. */}
      <p className="text-[11px] text-slate-400">{t("patientChart.canvas.draftNote")}</p>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={() => finishStroke()}
          onContextMenu={(e) => e.preventDefault()}
          // `-webkit-touch-callout` is the tablet's own long-press menu —
          // "Save image", "Copy" — offered over a session being written. There
          // is nothing here to save or copy. It is written as a class rather
          // than an inline style because a browser that does not know the
          // property drops it from an inline style object silently, and the one
          // browser that needs it is not the one this is developed in.
          className="block aspect-[12/7] w-full cursor-crosshair touch-none select-none [-webkit-touch-callout:none]"
          aria-label={t("patientChart.canvas.drawAria")}
          style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
        />
      </div>
    </div>
  )
}
