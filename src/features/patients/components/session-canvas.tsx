"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, Hand, RotateCcw } from "lucide-react"

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
/**
 * How long after the pen last moved a hand on the glass is taken for the hand
 * holding it. Long enough to cover the pause between words, short enough that
 * a deliberate tap a moment later still works.
 */
const WRIST_GUARD_MS = 1500
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
/** TEMPORARY — see the pen diagnostic in the component. */
interface PenLog {
  t0: number
  type: string
  down: number[]
  rect: number[]
  scroll: number[]
  vv: number[]
  dpr: number
  px: number[]
  notes: string[]
  moves: number[][]
}
const r1 = (n: number) => Math.round(n * 10) / 10
const PEN_LOG_MAX_MOVES = 60

/** Where this device remembers which hand writes on it. */
const HAND_KEY = "ob:writingHand"
type WritingHand = "left" | "right"

/**
 * While the drawing is on screen, nothing on the page can be selected.
 *
 * A writing wrist rests wherever the line happens to be, and below the
 * drawing there is always something: the session notes, then the patient's
 * timeline. On a tablet a hand at rest is a long press, so it selected the
 * text under it — "PATIENT TIMELINE", for a practitioner who writes left-
 * handed — and raised Look Up / Translate over the page. Protecting one area
 * at a time only moved the problem to the next one down.
 *
 * So the page is in "writing mode" while at least this much of the drawing is
 * visible, and normal otherwise: scroll down to read the history and its text
 * can be selected and copied again. Only on touch screens (see globals.css);
 * with a mouse, selection never gets in the way of anything.
 */
const WRITING_MODE_CLASS = "ob-writing"
const WRITING_MODE_VISIBLE = 0.3

/** Set by the first pen contact in this tab, so later charts start out knowing. */
let penSeenInThisTab = false

export function SessionCanvas({ initialStrokes, onStrokesChange, className }: Props) {
  const { t, isRtl } = useLocale()

  /**
   * Which hand writes, so the toolbar sits on the far side of it.
   *
   * Per device rather than per clinic: it is a fact about the person holding
   * this tablet. Read after mount, because the server has no storage to ask.
   */
  const [hand, setHand] = useState<WritingHand>("right")
  useEffect(() => {
    try {
      if (window.localStorage.getItem(HAND_KEY) === "left") setHand("left")
    } catch {
      /* storage unavailable: right-handed until told otherwise */
    }
  }, [])
  const toggleHand = () => {
    const next: WritingHand = hand === "left" ? "right" : "left"
    setHand(next)
    try {
      window.localStorage.setItem(HAND_KEY, next)
    } catch {
      /* the choice still holds for this visit */
    }
  }
  // Buttons on the physical side away from the writing hand. In a right-to-left
  // layout the first item in a row is drawn on the right, hence the flip.
  const toolsFirst = (hand === "right") !== isRtl
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
  /** Whether the contact drawing now is a finger or palm rather than a pen. */
  const activeIsTouch = useRef(false)
  // Remembered across charts in the same tab: a practitioner who wrote with a
  // pen on the last patient is holding one now, and his palm should not get
  // the first stroke on this one.
  const penSeen = useRef(penSeenInThisTab)
  /** Until when a hand touching the page counts as the writing hand. */
  const penWritingUntil = useRef(0)

  /*
   * TEMPORARY pen diagnostic (`?penlog=1`), to be removed with
   * /api/debug/pen once the tablet ink is fixed. Records what the tablet
   * reports for each stroke — positions, scroll, the drawing's size — and
   * sends it to the server log. Coordinates only.
   */
  const penLogOn = useRef(false)
  const penLog = useRef<PenLog | null>(null)
  useEffect(() => {
    try {
      penLogOn.current = new URLSearchParams(window.location.search).has("penlog")
    } catch {
      penLogOn.current = false
    }
  }, [])

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

  /*
   * While the pen is writing, the hand holding it presses nothing.
   *
   * On a tablet the wrist rests wherever the line being written happens to
   * be, and below the drawing that was a button: the voice memo's Record
   * (whose microphone prompt took the screen mid-word), and on a tablet held
   * upright, Complete Session in the bar along the bottom. A touch that is
   * not the pencil, landing anywhere on the page while the pen is in use or
   * just lifted, has its tap cancelled. The pencil identifies itself as a
   * stylus, so its own contacts are never touched; and a moment after the
   * pen goes quiet every button works again as normal.
   */
  useEffect(() => {
    // The browser announces each contact as a pointer — pen or touch — just
    // before its touch event, so the last one seen is the contact the touch
    // belongs to. Kept alongside `touchType` so a pencil tap on Undo is never
    // mistaken for the wrist, even where a browser leaves `touchType` out.
    let lastPointerType = ""
    const note = (e: PointerEvent) => {
      lastPointerType = e.pointerType
    }
    const guard = (e: TouchEvent) => {
      if (performance.now() > penWritingUntil.current) return
      if (lastPointerType === "pen") return
      const fromHand = Array.from(e.changedTouches).some(
        (touch) => (touch as Touch & { touchType?: string }).touchType !== "stylus",
      )
      if (fromHand && e.cancelable) e.preventDefault()
    }
    document.addEventListener("pointerdown", note, { capture: true })
    document.addEventListener("touchstart", guard, { capture: true, passive: false })
    return () => {
      document.removeEventListener("pointerdown", note, { capture: true })
      document.removeEventListener("touchstart", guard, { capture: true })
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof IntersectionObserver === "undefined") return
    const root = document.documentElement
    const observer = new IntersectionObserver(
      ([entry]) => root.classList.toggle(WRITING_MODE_CLASS, entry.intersectionRatio >= WRITING_MODE_VISIBLE),
      { threshold: [0, WRITING_MODE_VISIBLE, 1] },
    )
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      root.classList.remove(WRITING_MODE_CLASS)
    }
  }, [isMobileSmall])

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
      penLog.current?.notes.push(
        `resize ${canvas.width}x${canvas.height}->${width}x${height} rect ${r1(rect.left)},${r1(rect.top)},${r1(rect.width)},${r1(rect.height)}`,
      )
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
    if (e.pointerType === "pen") {
      penSeen.current = true
      penSeenInThisTab = true
      penWritingUntil.current = performance.now() + WRIST_GUARD_MS
      /*
       * The pen wins over a palm that got there first.
       *
       * "Once a pen has been seen, ignore fingers" only works from the second
       * stroke. On a freshly opened chart the hand lands before the pen does:
       * the palm took the one drawing slot, was inked as a smear, and the pen
       * was ignored until the palm lifted — which, for a hand resting on the
       * glass, is never. The pen went dead on the first word of every session.
       * A palm's "stroke" was never ink, so it is dropped and the canvas
       * redrawn without it, and its capture let go so its lifting later is
       * nothing to do with the pen.
       */
      if (activePointer.current !== null && activeIsTouch.current) {
        penLog.current?.notes.push("palm-takeover")
        try {
          e.currentTarget.releasePointerCapture(activePointer.current)
        } catch {
          /* the palm has already gone */
        }
        activePointer.current = null
        currentStroke.current = []
        redrawAll()
      } else if (activePointer.current !== null) {
        /*
         * A pen touching down while a pen stroke is still open means the last
         * lift never arrived — a system dialog took the screen mid-letter (the
         * microphone prompt does exactly that). There is one pencil, so that
         * stroke is over: keep what it drew and start a new one. Ignoring this
         * touch instead swallowed the next letter into the last, joined by a
         * straight line.
         */
        finishStroke()
      }
    }
    if (e.pointerType === "touch" && penSeen.current) return
    if (activePointer.current !== null) return
    activeIsTouch.current = e.pointerType === "touch"
    e.preventDefault()
    activePointer.current = e.pointerId
    rectRef.current = e.currentTarget.getBoundingClientRect()
    currentStroke.current = [toPoint(e.clientX, e.clientY, e.pressure)]
    drawnUpTo.current = 0
    if (penLogOn.current) {
      const r = rectRef.current
      const vv = window.visualViewport
      penLog.current = {
        t0: performance.now(),
        type: e.pointerType,
        down: [r1(e.clientX), r1(e.clientY), r1(e.pressure)],
        rect: [r1(r.left), r1(r.top), r1(r.width), r1(r.height)],
        scroll: [r1(window.scrollX), r1(window.scrollY)],
        vv: vv ? [r1(vv.scale), r1(vv.offsetLeft), r1(vv.offsetTop), r1(vv.pageTop)] : [],
        dpr: window.devicePixelRatio,
        px: [e.currentTarget.width, e.currentTarget.height],
        notes: [],
        moves: [],
      }
    }
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
    if (e.pointerType === "pen") penWritingUntil.current = performance.now() + WRIST_GUARD_MS

    // Everything the digitiser recorded since the last frame, not just the
    // sample that woke React. A pen reports several times faster than the
    // screen refreshes, and dropping the rest is what made a fast stroke
    // arrive as a run of straight lines.
    const native = e.nativeEvent
    const coalesced =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : []
    const samples = coalesced.length > 0 ? coalesced : [native]
    const log = penLog.current
    if (log && log.moves.length < PEN_LOG_MAX_MOVES) {
      const first = samples[0]
      const last = samples[samples.length - 1]
      log.moves.push([
        Math.round(performance.now() - log.t0),
        r1(native.clientX),
        r1(native.clientY),
        coalesced.length,
        r1(first.clientX),
        r1(first.clientY),
        r1(last.clientX),
        r1(last.clientY),
        r1(window.scrollY),
        r1(e.currentTarget.getBoundingClientRect().top),
      ])
    }
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
    if (!activeIsTouch.current) penWritingUntil.current = performance.now() + WRIST_GUARD_MS

    const pts = currentStroke.current
    currentStroke.current = []
    const log = penLog.current
    penLog.current = null
    if (log) {
      log.notes.push(`end ${e?.type ?? "takeover"} pts ${pts.length}`)
      try {
        void fetch("/api/debug/pen", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ ua: navigator.userAgent, ...log }),
          keepalive: true,
        }).catch(() => {})
      } catch {
        /* diagnostics never get in the way of writing */
      }
    }
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
        <p
          className={cn(
            "min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500",
            toolsFirst ? "order-2 text-end" : "order-1",
          )}
        >
          {t("patientChart.canvas.toolbarTitle")}
        </p>
        <div className={cn("flex items-center gap-2", toolsFirst ? "order-1" : "order-2")}>
        <button
          type="button"
          onClick={toggleHand}
          aria-pressed={hand === "left"}
          title={t("patientChart.canvas.handHint")}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Hand className={cn("size-3.5", hand === "left" && "-scale-x-100")} aria-hidden />
          {hand === "left" ? t("patientChart.canvas.handLeft") : t("patientChart.canvas.handRight")}
        </button>
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
          // Only the contact that is drawing ends the stroke. This used to end
          // it whichever contact lost capture, so a palm lifting mid-letter
          // cut the pen off and the rest of the letter was never recorded.
          onLostPointerCapture={finishStroke}
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
